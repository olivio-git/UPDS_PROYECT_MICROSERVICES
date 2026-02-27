"""
AI Question Generation Service
Orchestrates prompt generation, LLM calls, and response parsing
"""

import logging
import time
import asyncio
from typing import Dict, Any, List, Optional

from .prompt_templates import PromptTemplateEngine
from .response_parser import ResponseParser
from .llm_service import LocalLLMService
from ..schemas.question_generation import (
    QuestionGenerationRequest,
    QuestionGenerationResponse,
    GeneratedQuestion,
    Competency,
    QuestionType,
    MCERLevel
)

logger = logging.getLogger(__name__)

class QuestionGenerationService:
    """
    Main service for AI-powered question generation
    """

    def __init__(self):
        self.prompt_engine = PromptTemplateEngine()
        self.parser = ResponseParser()
        self.llm_service = None
        self._initialized = False
        self._initialization_lock = asyncio.Lock()

    async def initialize(self):
        """Initialize LLM service"""
        async with self._initialization_lock:
            if self._initialized:
                return

            try:
                logger.info("🤖 Inicializando servicio de generación de preguntas...")

                # Initialize LLM service (reuse existing one)
                self.llm_service = LocalLLMService()
                await self.llm_service.initialize()

                if not self.llm_service.enabled:
                    logger.warning("⚠️  LLM service no disponible - generación limitada")
                else:
                    logger.info("✅ Servicio de generación inicializado correctamente")

                self._initialized = True

            except Exception as e:
                logger.error(f"❌ Error inicializando servicio de generación: {e}")
                raise

    async def generate_questions(self, request: QuestionGenerationRequest) -> QuestionGenerationResponse:
        """
        Generate questions based on request parameters
        """
        start_time = time.time()

        try:
            # Ensure service is initialized
            await self.initialize()

            logger.info(f"🔄 Generando pregunta: {request.competency.value} | "
                       f"{request.question_type.value} | {request.level.value}")

            # Generate questions (support multiple if requested)
            generated_questions = []
            total_tokens = 0
            confidence_scores = []

            for i in range(request.question_count or 1):
                try:
                    question, tokens_used, confidence = await self._generate_single_question(
                        request, attempt=i+1
                    )
                    logger.debug(f"📝 Pregunta generada: {question.content.question[:100]}...")
                    generated_questions.append(question)
                    total_tokens += tokens_used
                    confidence_scores.append(confidence)
                    logger.info(f"✅ Pregunta {i+1}/{request.question_count or 1} generada exitosamente")

                except Exception as e:
                    logger.error(f"❌ Error generando pregunta {i+1}: {e}")

                    # Create fallback question for this attempt
                    fallback_question = self._create_basic_fallback(request)
                    generated_questions.append(fallback_question)
                    confidence_scores.append(0.1)

            processing_time = time.time() - start_time
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

            # Generate suggestions for improvement
            suggestions = self._generate_improvement_suggestions(generated_questions, request)

            return QuestionGenerationResponse(
                success=True,
                message=f"Generated {len(generated_questions)} question(s) successfully",
                processing_time=processing_time,
                generated_questions=generated_questions,
                model_used=getattr(self.llm_service, 'model_name', 'fallback') if self.llm_service else 'fallback',
                prompt_tokens=total_tokens,
                confidence_score=avg_confidence,
                validation_passed=all(self._validate_question_quality(q) for q in generated_questions),
                suggestions=suggestions
            )

        except Exception as e:
            logger.error(f"❌ Error crítico en generación de preguntas: {e}")
            processing_time = time.time() - start_time

            # Return response with fallback question
            fallback_question = self._create_basic_fallback(request)

            return QuestionGenerationResponse(
                success=False,
                message=f"Error in generation: {str(e)}",
                processing_time=processing_time,
                generated_questions=[fallback_question],
                model_used="fallback",
                confidence_score=0.0,
                validation_passed=False,
                suggestions=["Review generation parameters and try again"]
            )

    async def _generate_single_question(self,
                                      request: QuestionGenerationRequest,
                                      attempt: int = 1) -> tuple[GeneratedQuestion, int, float]:
        """Generate a single question with retries"""

        max_retries = 2
        last_error = None
        is_template_copying_retry = False

        for retry in range(max_retries + 1):
            try:
                # Build specialized prompt - make it more aggressive if previous attempt copied templates
                prompt = self.prompt_engine.generate_prompt(
                    competency=request.competency,
                    question_type=request.question_type,
                    level=request.level,
                    difficulty=request.difficulty,
                    topic=request.topic,
                    subtopic=request.subtopic,
                    context=request.context,
                    thematic_context=getattr(request, 'thematic_context', None),
                    target_language=getattr(request, 'target_language', 'en'),
                    anti_copy_mode=is_template_copying_retry  # New parameter
                )

                logger.debug(f"🔧 Prompt generado (intento {retry + 1}):\n{prompt[:200]}...")

                # Call LLM
                if self.llm_service and self.llm_service.enabled:
                    llm_response = await self._call_llm_with_timeout(prompt, timeout=90)
                    logger.info(f"LLM response: {llm_response}")
                    tokens_used = len(prompt.split()) + len(llm_response.split())  # Rough estimate
                else:
                    logger.warning("⚠️  LLM no disponible, usando respuesta sintética")
                    llm_response = self._generate_synthetic_response(request)
                    tokens_used = 0

                logger.debug(f"🤖 Respuesta LLM recibida: {llm_response[:200]}...")

                # Parse response
                request_context = {
                    "competency": request.competency.value,
                    "question_type": request.question_type.value,
                    "level": request.level.value,
                    "difficulty": request.difficulty,
                    "topic": request.topic,
                    "subtopic": request.subtopic
                }

                question, fallbacks_applied = self.parser.parse_ai_response(llm_response, request_context)

                # Calculate confidence based on fallbacks
                confidence = max(0.1, 1.0 - (len(fallbacks_applied) * 0.15))

                logger.info(f"✅ Pregunta parseada - Fallbacks aplicados: {len(fallbacks_applied)}")

                return question, tokens_used, confidence

            except Exception as e:
                last_error = e
                logger.warning(f"⚠️  Error en intento {retry + 1}: {e}")

                # Check if this is a template copying error - activate anti-copy mode
                if "copying template content" in str(e).lower() or "forbidden template content" in str(e).lower():
                    is_template_copying_retry = True
                    logger.warning(f"🚫 Activating ANTI-COPY mode for retry {retry + 2}")

                if retry < max_retries:
                    await asyncio.sleep(2)  # Longer pause for template copying issues
                    continue
                else:
                    break

        # All retries failed
        logger.error(f"❌ Todos los intentos fallaron. Último error: {last_error}")
        raise Exception(f"Failed to generate question after {max_retries + 1} attempts: {last_error}")

    async def _call_llm_with_timeout(self, prompt: str, timeout: int = 120) -> str:
        """Call LLM with timeout protection"""
        try:
            # Use the existing LLM service method
            if hasattr(self.llm_service, 'generate'):
                result = await asyncio.wait_for(
                    self.llm_service.generate(prompt),
                    timeout=timeout
                )
                return result
            else:
                # Use the method from the grading service
                result = await asyncio.wait_for(
                    self.llm_service._generate_text(prompt),
                    timeout=timeout
                )
                return result

        except asyncio.TimeoutError:
            raise Exception(f"LLM call timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

    def _generate_synthetic_response(self, request: QuestionGenerationRequest) -> str:
        """Generate synthetic response when LLM is not available"""

        templates = {
            "reading_multiple_choice": '''{
                "type": "multiple_choice",
                "competency": "reading",
                "level": "B1",
                "difficulty": 3,
                "content": {
                    "question": "What is the main idea of the text?",
                    "context": "The text discusses the importance of education in personal and professional development. Many students find that regular study habits and active engagement with learning materials significantly enhance their academic performance. Educational institutions worldwide have recognized that personalized learning approaches can better accommodate diverse learning styles and help students achieve their full potential.",
                    "options": [
                        {"id": "1", "text": "Education is fundamental for development", "is_correct": true},
                        {"id": "2", "text": "Development is optional", "is_correct": false},
                        {"id": "3", "text": "Professional growth is secondary", "is_correct": false},
                        {"id": "4", "text": "The text has no main theme", "is_correct": false}
                    ],
                    "correct_answer": "1"
                },
                "metadata": {
                    "topic": "education",
                    "tags": ["comprehension", "reading"],
                    "estimated_time": 3
                },
                "points": 1
            }''',

            "writing_essay": '''{
                "type": "essay",
                "competency": "writing",
                "level": "B2",
                "difficulty": 4,
                "content": {
                    "question": "Write a 200-word essay about the importance of technology in modern education.",
                    "instructions": "Include an introduction, development, and conclusion. Use appropriate connectors.",
                    "keywords": ["technology", "education", "advantages", "disadvantages", "future"]
                },
                "metadata": {
                    "topic": "technology",
                    "subtopic": "education",
                    "tags": ["essay", "argumentation", "technology"],
                    "estimated_time": 25
                },
                "points": 10
            }''',

            "grammar_fill_blanks": '''{
                "type": "fill_blanks",
                "competency": "grammar",
                "level": "A2",
                "difficulty": 2,
                "content": {
                    "question": "Complete the sentences with the correct form of the verb.",
                    "template": "Yesterday I ___ (go) to the market and ___ (buy) fresh fruits.",
                    "correct_answer": ["went", "bought"],
                    "keywords": ["past tense", "irregular verbs"]
                },
                "metadata": {
                    "topic": "grammar",
                    "subtopic": "past tense verbs",
                    "tags": ["past tense", "grammar"],
                    "estimated_time": 5
                },
                "points": 2
            }'''
        }

        # Select appropriate template
        template_key = f"{request.competency.value}_{request.question_type.value}"

        # Try specific template first, then fallback
        if template_key in templates:
            template = templates[template_key]
        elif request.competency.value in ["reading", "writing", "grammar"]:
            fallback_keys = [k for k in templates.keys() if k.startswith(request.competency.value)]
            template = templates[fallback_keys[0]] if fallback_keys else templates["reading_multiple_choice"]
        else:
            template = templates["reading_multiple_choice"]

        # Customize template with request parameters
        template = template.replace('"level": "B1"', f'"level": "{request.level.value}"')
        template = template.replace('"difficulty": 3', f'"difficulty": {request.difficulty}')

        if request.topic:
            template = template.replace('"topic": "education"', f'"topic": "{request.topic}"')
            template = template.replace('"topic": "technology"', f'"topic": "{request.topic}"')
            template = template.replace('"topic": "grammar"', f'"topic": "{request.topic}"')

        return template

    def _validate_question_quality(self, question: GeneratedQuestion) -> bool:
        """Basic quality validation for generated questions"""

        try:
            # Check minimum content length
            if not question.content.question or len(question.content.question.strip()) < 10:
                return False

            # Type-specific validation
            if question.type in ["multiple_choice", "true_false"]:
                if not question.content.options or len(question.content.options) < 2:
                    return False

                correct_count = sum(1 for opt in question.content.options if opt.is_correct)
                if correct_count != 1:  # Exactly one correct answer
                    return False

            # Check for reasonable difficulty/level matching
            if question.difficulty < 1 or question.difficulty > 5:
                return False

            return True

        except Exception as e:
            logger.error(f"❌ Error validating question quality: {e}")
            return False

    def _generate_improvement_suggestions(self,
                                        questions: List[GeneratedQuestion],
                                        request: QuestionGenerationRequest) -> List[str]:
        """Generate suggestions for improving questions"""

        suggestions = []

        for question in questions:
            if question.fallback_used:
                suggestions.append("Consider reviewing the generated content and adding more specific details")

            if question.type == "multiple_choice" and question.content.options:
                if len(question.content.options) < 4:
                    suggestions.append("Consider adding more distractors for better discrimination")

            if not question.content.instructions and question.type in ["essay", "speaking", "writing"]:
                suggestions.append("Add specific instructions to guide student responses")

            # Level-specific suggestions
            if request.level in ["C1", "C2"] and len(question.content.question) < 50:
                suggestions.append("Consider adding more complex language for advanced levels")

        # Remove duplicates
        return list(set(suggestions))

    def _create_basic_fallback(self, request: QuestionGenerationRequest) -> GeneratedQuestion:
        """Create basic fallback question"""

        # Use the parser's fallback method
        context = {
            "competency": request.competency.value,
            "question_type": request.question_type.value,
            "level": request.level.value,
            "difficulty": request.difficulty,
            "topic": request.topic or "general"
        }

        return self.parser._create_fallback_question(context, "Service fallback")

    def get_generation_statistics(self) -> Dict[str, Any]:
        """Get service statistics"""

        return {
            "service_initialized": self._initialized,
            "llm_available": bool(self.llm_service and self.llm_service.enabled),
            "supported_competencies": [comp.value for comp in Competency],
            "supported_question_types": [qt.value for qt in QuestionType],
            "supported_levels": [level.value for level in MCERLevel]
        }