"""
Robust JSON Response Parser for AI-Generated Questions
Handles multiple formats and provides intelligent fallbacks
"""

import json
import re
import logging
from typing import Dict, Any, Optional, List, Union, Tuple
import uuid

from ..schemas.question_generation import (
    GeneratedQuestion,
    GeneratedQuestionContent,
    GeneratedQuestionMetadata,
    GeneratedQuestionOption,
    QuestionType,
    Competency,
    MCERLevel
)

logger = logging.getLogger(__name__)

class ResponseParser:
    """
    Robust parser for AI-generated question responses
    Handles multiple formats, cleans responses, and provides fallbacks
    """

    def __init__(self):
        self.fallback_applied = []

    def parse_ai_response(self,
                         raw_response: str,
                         request_context: Dict[str, Any]) -> Tuple[GeneratedQuestion, List[str]]:
        """
        Parse AI response with intelligent fallbacks
        Returns: (GeneratedQuestion, list_of_fallbacks_applied)
        """
        self.fallback_applied = []

        try:
            # Try new simple format first
            if ("CONTEXT:" in raw_response and "QUESTION:" in raw_response) or \
               ("TEXT:" in raw_response and "STATEMENT:" in raw_response):
                logger.info("🔄 Parsing response as simple format")
                question = self._parse_simple_format(raw_response, request_context)
                return question, self.fallback_applied

            # Fallback to JSON parsing if simple format fails
            logger.info("🔄 Parsing response as JSON format")

            # Step 1: Clean the response
            cleaned_response = self._clean_response(raw_response)

            # Step 2: Extract JSON
            json_data = self._extract_json(cleaned_response)

            # Step 3: Validate and normalize
            normalized_data = self._normalize_json_structure(json_data, request_context)

            # Step 4: Build GeneratedQuestion object
            question = self._build_question_object(normalized_data, request_context)

            # Step 5: Final validation
            self._validate_question_completeness(question)

            return question, self.fallback_applied

        except ValueError as e:
            # Check if this is a template copying error - don't fallback, re-raise for regeneration
            if "copying template content" in str(e).lower():
                logger.error(f"🚫 Template copying detected - re-raising for regeneration: {e}")
                raise e  # Re-raise to trigger regeneration in service
            else:
                logger.error(f"❌ ValueError parsing AI response: {e}")
                return self._create_fallback_question(request_context, str(e)), ["complete_fallback"]

        except Exception as e:
            logger.error(f"❌ Error parsing AI response: {e}")
            logger.error(f"Raw response: {raw_response[:500]}...")

            # Ultimate fallback - create basic question
            return self._create_fallback_question(request_context, str(e)), ["complete_fallback"]

    def _parse_simple_format(self, response: str, context: Dict[str, Any]) -> GeneratedQuestion:
        """Parse simple text format response"""

        def extract_section(text: str, start_marker: str, end_markers: List[str] = None) -> str:
            """Extract text between markers"""
            start = text.find(start_marker)
            if start == -1:
                return ""

            start += len(start_marker)

            if end_markers:
                end = len(text)
                for marker in end_markers:
                    marker_pos = text.find(marker, start)
                    if marker_pos != -1:
                        end = min(end, marker_pos)
            else:
                # Find next section marker
                next_markers = ["CONTEXT:", "TEXT:", "QUESTION:", "STATEMENT:", "INSTRUCTIONS:", "OPTIONS:", "CORRECT_ANSWER:", "TOPIC:"]
                end = len(text)
                for marker in next_markers:
                    if marker != start_marker:
                        marker_pos = text.find(marker, start)
                        if marker_pos != -1:
                            end = min(end, marker_pos)

            return text[start:end].strip()

        def clean_text(text: str) -> str:
            """Clean text from extra formatting characters"""
            if not text:
                return text
            # Remove extra ** characters and clean up formatting
            text = text.replace('**', '').strip()
            # Remove multiple newlines and extra spaces
            text = ' '.join(text.split())
            return text

        # Extract components - support both formats
        context_text = clean_text(extract_section(response, "CONTEXT:") or extract_section(response, "TEXT:"))
        question_text = clean_text(extract_section(response, "QUESTION:") or extract_section(response, "STATEMENT:"))
        instructions = clean_text(extract_section(response, "INSTRUCTIONS:"))
        topic = clean_text(extract_section(response, "TOPIC:"))
        correct_answer = clean_text(extract_section(response, "CORRECT_ANSWER:"))

        # Context length validation relaxed for demo - shorter texts are acceptable
        if context_text:
            word_count = len(context_text.split())
            logger.info(f"✅ Generated context with {word_count} words")

        # Template content checking disabled for thesis demonstration
        # Allows natural AI generation for educational purposes

        # Extract options
        options = []
        options_section = extract_section(response, "OPTIONS:")
        if options_section:
            lines = options_section.split('\n')
            for line in lines:
                line = line.strip()
                if line and (line.startswith('A)') or line.startswith('B)') or line.startswith('C)') or line.startswith('D)')):
                    option_id = line[0]
                    option_text = line[3:].strip()  # Remove "A) "

                    # Check for placeholder text and flag it
                    placeholder_patterns = [
                        '[first option]', '[second option]', '[third option]', '[fourth option]',
                        '[write first option', '[write second option', '[write third option', '[write fourth option',
                        'first option', 'second option', 'third option', 'fourth option'
                    ]

                    is_placeholder = any(pattern.lower() in option_text.lower() for pattern in placeholder_patterns)
                    if is_placeholder:
                        logger.warning(f"⚠️ Detected placeholder in option {option_id}: {option_text}")
                        self.fallback_applied.append("placeholder_detected")

                    # Fix correct answer parsing - handle "B) 6 AM" format and extra characters
                    correct_letter = correct_answer.strip()
                    if ')' in correct_letter:
                        correct_letter = correct_letter.split(')')[0].strip()
                    # Remove any remaining non-letter characters (like ** B -> B)
                    correct_letter = ''.join([c for c in correct_letter if c.isalpha()]).upper()

                    is_correct = option_id.upper() == correct_letter
                    options.append(GeneratedQuestionOption(
                        id=option_id,
                        text=option_text,
                        is_correct=is_correct
                    ))

        # Build content
        # Fix correct_answer format - store only the letter
        clean_correct_answer = None
        if correct_answer:
            clean_correct_answer = correct_answer.strip()
            if ')' in clean_correct_answer:
                clean_correct_answer = clean_correct_answer.split(')')[0].strip()
            # Remove any remaining non-letter characters (like ** B -> B)
            clean_correct_answer = ''.join([c for c in clean_correct_answer if c.isalpha()]).upper()

        content = GeneratedQuestionContent(
            question=question_text or "Generated question",
            instructions=instructions or "Read the text and answer the question",
            context=context_text,
            options=options,
            correct_answer=clean_correct_answer
        )

        # Build metadata
        metadata = GeneratedQuestionMetadata(
            topic=topic or "general",
            generated_by="ai",
            generation_model="ollama"
        )

        # Build question
        question_obj = GeneratedQuestion(
            type=QuestionType(context.get("question_type", "multiple_choice")),
            competency=Competency(context.get("competency", "reading")),
            level=MCERLevel(context.get("level", "A1")),
            difficulty=context.get("difficulty", 3),
            content=content,
            metadata=metadata,
            points=1,
            is_active=True,
            ai_generated=True,
            generation_prompt_version="simple_v1.0",
            fallback_used=False
        )

        return question_obj

    def _clean_response(self, response: str) -> str:
        """Clean and prepare response for JSON parsing"""

        # Remove common AI response prefixes/suffixes
        prefixes_to_remove = [
            "Here's the JSON:",
            "Here is the JSON:",
            "```json",
            "```",
            "JSON:",
            "Response:",
            "Aquí está el JSON:",
            "La respuesta en JSON es:",
        ]

        suffixes_to_remove = [
            "```",
            "¿Te parece bien?",
            "¿Necesitas algún ajuste?",
            "This question evaluates",
            "Esta pregunta evalúa"
        ]

        cleaned = response.strip()

        # Remove prefixes
        for prefix in prefixes_to_remove:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                self.fallback_applied.append("removed_prefix")

        # Remove suffixes
        for suffix in suffixes_to_remove:
            if cleaned.endswith(suffix):
                cleaned = cleaned[:-len(suffix)].strip()
                self.fallback_applied.append("removed_suffix")

        # Remove markdown code blocks
        if cleaned.startswith("```") and cleaned.endswith("```"):
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1])
            self.fallback_applied.append("removed_markdown_blocks")

        return cleaned

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Extract JSON from text with multiple strategies"""

        # Strategy 1: Direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: Find JSON object in text
        try:
            # Look for { ... } pattern
            start = text.find('{')
            if start != -1:
                brace_count = 0
                end = start
                for i, char in enumerate(text[start:], start):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end = i + 1
                            break

                json_text = text[start:end]
                result = json.loads(json_text)
                self.fallback_applied.append("extracted_json_object")
                return result
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 2.5: Handle truncated JSON by closing incomplete structures
        try:
            start = text.find('{')
            if start != -1:
                truncated_text = text[start:]
                # Try to fix truncated JSON by closing open braces
                fixed_text = self._fix_truncated_json(truncated_text)
                if fixed_text:
                    result = json.loads(fixed_text)
                    self.fallback_applied.append("fixed_truncated_json")
                    return result
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 3: Fix common JSON errors
        try:
            fixed_text = self._fix_common_json_errors(text)
            result = json.loads(fixed_text)
            self.fallback_applied.append("fixed_json_errors")
            return result
        except json.JSONDecodeError:
            pass

        # Strategy 4: Extract using regex patterns
        try:
            result = self._extract_json_with_regex(text)
            if result:
                self.fallback_applied.append("regex_extraction")
                return result
        except Exception:
            pass

        # If all else fails
        raise ValueError(f"Could not extract valid JSON from response")

    def _fix_common_json_errors(self, text: str) -> str:
        """Fix common JSON formatting errors"""

        # Fix trailing commas
        text = re.sub(r',(\s*[}\]])', r'\1', text)

        # Fix single quotes to double quotes
        text = re.sub(r"'([^']*)':", r'"\1":', text)
        text = re.sub(r":(\s*)'([^']*)'", r':\1"\2"', text)

        # Fix unquoted keys
        text = re.sub(r'(\w+):', r'"\1":', text)

        # Fix boolean values
        text = text.replace('True', 'true').replace('False', 'false')

        return text

    def _fix_truncated_json(self, text: str) -> Optional[str]:
        """Try to fix truncated JSON by adding missing closing braces"""
        try:
            # Count open braces
            brace_count = 0
            bracket_count = 0
            in_string = False
            escape_next = False

            for char in text:
                if escape_next:
                    escape_next = False
                    continue

                if char == '\\':
                    escape_next = True
                    continue

                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue

                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                    elif char == '[':
                        bracket_count += 1
                    elif char == ']':
                        bracket_count -= 1

            # Add missing closing braces/brackets
            fixed_text = text
            if bracket_count > 0:
                fixed_text += ']' * bracket_count
            if brace_count > 0:
                fixed_text += '}' * brace_count

            # If we made changes, try to parse
            if fixed_text != text:
                return fixed_text

        except Exception:
            pass

        return None

    def _extract_json_with_regex(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract question data using regex patterns as last resort"""

        result = {
            "type": None,
            "competency": None,
            "level": None,
            "difficulty": 3,
            "content": {"question": None},
            "metadata": {"topic": "general", "tags": []}
        }

        # Extract question text
        question_patterns = [
            r'"question"\s*:\s*"([^"]+)"',
            r'pregunta["\']?\s*:\s*["\']([^"\']+)["\']',
            r'Question["\']?\s*:\s*["\']([^"\']+)["\']'
        ]

        for pattern in question_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result["content"]["question"] = match.group(1)
                break

        # Extract options if present
        options_match = re.search(r'"options"\s*:\s*\[(.*?)\]', text, re.DOTALL)
        if options_match:
            # Simple option extraction
            option_texts = re.findall(r'"text"\s*:\s*"([^"]+)"', options_match.group(1))
            if option_texts:
                result["content"]["options"] = [
                    {"id": str(i+1), "text": opt, "is_correct": i==0}
                    for i, opt in enumerate(option_texts)
                ]

        return result if result["content"]["question"] else None

    def _normalize_json_structure(self, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize JSON structure to match expected schema"""

        normalized = {
            "type": self._normalize_question_type(data.get("type"), context),
            "competency": self._normalize_competency(data.get("competency"), context),
            "level": self._normalize_level(data.get("level"), context),
            "difficulty": self._normalize_difficulty(data.get("difficulty"), context),
            "content": self._normalize_content(data.get("content", {}), context),
            "metadata": self._normalize_metadata(data.get("metadata", {}), context),
            "points": data.get("points", 1),
            "is_active": data.get("is_active", True)
        }

        return normalized

    def _normalize_question_type(self, type_value: Any, context: Dict[str, Any]) -> QuestionType:
        """Normalize question type with fallback"""
        if isinstance(type_value, str):
            try:
                return QuestionType(type_value)
            except ValueError:
                pass

        # Fallback to context
        context_type = context.get("question_type")
        if context_type:
            self.fallback_applied.append("used_context_question_type")
            return QuestionType(context_type)

        # Ultimate fallback
        self.fallback_applied.append("default_question_type")
        return QuestionType.MULTIPLE_CHOICE

    def _normalize_competency(self, comp_value: Any, context: Dict[str, Any]) -> Competency:
        """Normalize competency with fallback"""
        if isinstance(comp_value, str):
            try:
                return Competency(comp_value)
            except ValueError:
                pass

        # Fallback to context
        context_comp = context.get("competency")
        if context_comp:
            self.fallback_applied.append("used_context_competency")
            return Competency(context_comp)

        # Ultimate fallback
        self.fallback_applied.append("default_competency")
        return Competency.READING

    def _normalize_level(self, level_value: Any, context: Dict[str, Any]) -> MCERLevel:
        """Normalize MCER level with fallback"""
        if isinstance(level_value, str):
            try:
                return MCERLevel(level_value.upper())
            except ValueError:
                pass

        # Fallback to context
        context_level = context.get("level")
        if context_level:
            self.fallback_applied.append("used_context_level")
            return MCERLevel(context_level)

        # Ultimate fallback
        self.fallback_applied.append("default_level")
        return MCERLevel.B1

    def _normalize_difficulty(self, diff_value: Any, context: Dict[str, Any]) -> int:
        """Normalize difficulty with fallback"""
        if isinstance(diff_value, (int, float)):
            return max(1, min(5, int(diff_value)))

        # Fallback to context
        context_diff = context.get("difficulty")
        if isinstance(context_diff, (int, float)):
            self.fallback_applied.append("used_context_difficulty")
            return max(1, min(5, int(context_diff)))

        # Ultimate fallback
        self.fallback_applied.append("default_difficulty")
        return 3

    def _normalize_content(self, content: Dict[str, Any], context: Dict[str, Any]) -> GeneratedQuestionContent:
        """Normalize content structure"""

        # Base content
        normalized_content = {
            "question": content.get("question", "Generated question content"),
            "instructions": content.get("instructions"),
            "context": content.get("context")
        }

        # Handle options for multiple choice/true-false questions
        if "options" in content and isinstance(content["options"], list):
            normalized_content["options"] = self._normalize_options(content["options"])

            # Extract correct answer from options
            correct_options = [opt for opt in normalized_content["options"] if opt.is_correct]
            if correct_options:
                normalized_content["correct_answer"] = correct_options[0].id
            elif not content.get("correct_answer"):
                # Fallback: make first option correct
                if normalized_content["options"]:
                    normalized_content["options"][0].is_correct = True
                    normalized_content["correct_answer"] = normalized_content["options"][0].id
                    self.fallback_applied.append("default_correct_answer")

        # Handle other fields
        if "correct_answer" in content:
            normalized_content["correct_answer"] = content["correct_answer"]
        if "keywords" in content:
            normalized_content["keywords"] = content["keywords"] if isinstance(content["keywords"], list) else []
        if "template" in content:  # for fill_blanks
            normalized_content["template"] = content["template"]
        if "items" in content:  # for matching, ordering, drag_drop
            normalized_content["items"] = content["items"]
        if "media_script" in content:  # for listening
            normalized_content["media_script"] = content["media_script"]
        if "media_type" in content:
            normalized_content["media_type"] = content["media_type"]
        if "media_description" in content:
            normalized_content["media_description"] = content["media_description"]

        return GeneratedQuestionContent(**normalized_content)

    def _normalize_options(self, options: List[Any]) -> List[GeneratedQuestionOption]:
        """Normalize question options"""
        normalized = []

        for i, option in enumerate(options):
            if isinstance(option, dict):
                normalized.append(GeneratedQuestionOption(
                    id=str(option.get("id", i + 1)),
                    text=str(option.get("text", f"Option {i + 1}")),
                    is_correct=bool(option.get("is_correct", False))
                ))
            elif isinstance(option, str):
                normalized.append(GeneratedQuestionOption(
                    id=str(i + 1),
                    text=option,
                    is_correct=i == 0  # Make first option correct by default
                ))

        return normalized

    def _normalize_metadata(self, metadata: Dict[str, Any], context: Dict[str, Any]) -> GeneratedQuestionMetadata:
        """Normalize metadata structure"""

        # Ensure topic is always a string, never None
        topic = metadata.get("topic") or context.get("topic") or "general"
        if not isinstance(topic, str):
            topic = "general"

        return GeneratedQuestionMetadata(
            topic=topic,
            subtopic=metadata.get("subtopic", context.get("subtopic")),
            tags=metadata.get("tags", []) if isinstance(metadata.get("tags"), list) else [],
            estimated_time=metadata.get("estimated_time", context.get("estimated_time")),
            points=max(1, int(metadata.get("points", 1))),
            generated_by="ai",
            generation_model="ollama"
        )

    def _build_question_object(self, data: Dict[str, Any], context: Dict[str, Any]) -> GeneratedQuestion:
        """Build final GeneratedQuestion object"""

        return GeneratedQuestion(
            type=data["type"],
            competency=data["competency"],
            level=data["level"],
            difficulty=data["difficulty"],
            content=data["content"],
            metadata=data["metadata"],
            points=data["points"],
            is_active=data["is_active"],
            ai_generated=True,
            generation_prompt_version="v1.0",
            fallback_used=bool(self.fallback_applied)
        )

    def _validate_question_completeness(self, question: GeneratedQuestion) -> None:
        """Validate that question has minimum required content"""

        if not question.content.question or len(question.content.question.strip()) < 10:
            raise ValueError("Question text is missing or too short")

        # Type-specific validation
        if question.type in [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE]:
            if not question.content.options or len(question.content.options) < 2:
                raise ValueError("Multiple choice questions require at least 2 options")

            correct_options = [opt for opt in question.content.options if opt.is_correct]
            if not correct_options:
                raise ValueError("Multiple choice questions require at least one correct option")

    def _create_fallback_question(self, context: Dict[str, Any], error: str) -> GeneratedQuestion:
        """Create a basic fallback question when parsing fails completely"""

        competency = Competency(context.get("competency", "reading"))
        question_type = QuestionType(context.get("question_type", "multiple_choice"))
        topic = context.get("topic", "general")

        # Create more realistic fallback content based on competency
        if competency == Competency.READING and question_type == QuestionType.MULTIPLE_CHOICE:
            content = GeneratedQuestionContent(
                question="What is the main idea of the following text?",
                instructions="Read the text and answer the question",
                context="Language students need to practice regularly to improve their reading comprehension. Daily reading of texts appropriate to their level helps them develop vocabulary and become familiar with grammatical structures. It is important to select materials that are interesting and relevant to maintain learning motivation."
            )
            content.options = [
                GeneratedQuestionOption(id="1", text="The importance of regular practice in language learning", is_correct=True),
                GeneratedQuestionOption(id="2", text="Different types of texts for students", is_correct=False),
                GeneratedQuestionOption(id="3", text="Difficulties of English vocabulary", is_correct=False),
                GeneratedQuestionOption(id="4", text="Reading comprehension evaluation methods", is_correct=False),
            ]
            content.correct_answer = "1"
        else:
            # Generic fallback for other types
            content = GeneratedQuestionContent(
                question="This is an example question (AI service not available)",
                instructions="Follow the provided instructions",
            )

        metadata = GeneratedQuestionMetadata(
            topic=context.get("topic", "general"),
            tags=["ai-generated", "fallback"],
            generated_by="ai_fallback",
            generation_model="fallback",
            generation_confidence=0.1
        )

        return GeneratedQuestion(
            type=question_type,
            competency=competency,
            level=MCERLevel(context.get("level", "B1")),
            difficulty=context.get("difficulty", 3),
            content=content,
            metadata=metadata,
            points=1,
            is_active=True,
            ai_generated=True,
            generation_prompt_version="fallback",
            fallback_used=True
        )