import spacy
from spacy import displacy
import re
from typing import Dict, List, Any, Optional, Tuple
import asyncio
import time
import logging
from textstat import flesch_reading_ease, flesch_kincaid_grade, automated_readability_index
from collections import Counter
import numpy as np

from ..schemas.grading import (
    WritingEvaluationRequest, 
    WritingEvaluationResponse,
    ReadingEvaluationRequest,
    ReadingEvaluationResponse,
    TextMetrics, 
    GrammarError, 
    MCERLevel
)
from ..config.settings import settings
from ..services.llm_service import LocalLLMService

logger = logging.getLogger(__name__)

# Lazy-check for language-tool availability
_LANG_TOOL_AVAILABLE = False
try:
    import language_tool_python  # type: ignore
    _LANG_TOOL_AVAILABLE = True
except Exception:
    _LANG_TOOL_AVAILABLE = False

class TextGradingService:
    """
    Service for evaluating written text responses
    Handles both writing and reading comprehension evaluation
    """
    
    def __init__(self):
        self.nlp = None
        self.sentiment_analyzer = None
        self.grammar_checker = None
        self.llm_service = None
        self._model_loaded = False
        self._loading_lock = asyncio.Lock()
    
    async def initialize_models(self):
        """Initialize AI models asynchronously"""
        async with self._loading_lock:
            if self._model_loaded:
                return
                
            logger.info("🤖 Iniciando carga de modelos de texto...")

            # Load spaCy model (critical)
            try:
                logger.info(f"📦 Cargando modelo spaCy: {settings.spacy_model}")
                self.nlp = spacy.load(settings.spacy_model)
            except Exception as e:
                logger.warning(f"⚠️  Error cargando modelo preferido {settings.spacy_model}: {e}")
                # Try fallback models
                fallback_models = ['es_core_news_sm', 'en_core_web_sm', 'es', 'en']
                for model in fallback_models:
                    try:
                        logger.info(f"📦 Intentando modelo fallback: {model}")
                        self.nlp = spacy.load(model)
                        logger.info(f"✅ Modelo fallback {model} cargado exitosamente")
                        break
                    except:
                        continue
                else:
                    # If no spaCy models work, create a blank one
                    logger.warning("⚠️  Ningún modelo spaCy disponible, creando modelo básico")
                    self.nlp = spacy.blank('es')  # Basic Spanish model

            # Use VADER for fast sentiment analysis (no model download needed)
            try:
                from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
                logger.info("📦 Cargando analizador VADER...")
                self.sentiment_analyzer = SentimentIntensityAnalyzer()
                logger.info("✅ Analizador VADER cargado (instantáneo)")
            except Exception as e:
                logger.warning(f"VADER no disponible: {e}")
                self.sentiment_analyzer = None

            # Initialize LLM service for enhanced feedback (with retry logic)
            try:
                logger.info("🔧 DEBUG: Intentando importar LocalLLMService...")
                from ..services.llm_service import LocalLLMService
                logger.info("✅ DEBUG: Import LocalLLMService exitoso")

                if self.llm_service is None:
                    logger.info("🤖 Inicializando LLM service (Ollama)...")
                    from ..services.llm_service import FeedbackFormat
                    # Defer to settings.llm_feedback_format si existe
                    fmt_env = getattr(settings, 'llm_feedback_format', 'markdown')
                    fmt = FeedbackFormat.MARKDOWN
                    if isinstance(fmt_env, str):
                        low = fmt_env.lower()
                        if low == 'json':
                            fmt = FeedbackFormat.JSON
                        elif low in ('hybrid','both'): 
                            fmt = FeedbackFormat.HYBRID
                    self.llm_service = LocalLLMService(feedback_format=fmt)
                else:
                    logger.info("♻️ Reutilizando instancia existente de LLM service")

                logger.info(f"🔧 DEBUG: LLM enabled (pre-init) = {self.llm_service.enabled}")
                logger.info(f"🔧 DEBUG: Ollama URL = {self.llm_service.ollama_url}")
                await self.llm_service.initialize()
                if self.llm_service.enabled:
                    logger.info("✅ LLM service conectado y listo")
                else:
                    # Retry once if settings say it should be enabled
                    if getattr(settings, 'llm_enabled', False):
                        logger.info("🔁 Reintentando conexión a LLM (segundo intento)...")
                        await asyncio.sleep(1)
                        await self.llm_service.initialize()
                    if self.llm_service.enabled:
                        logger.info("✅ LLM conectado en reintento")
                    else:
                        logger.info("ℹ️  LLM sigue deshabilitado tras reintento - fallback a feedback tradicional")
            except Exception as e:
                logger.warning(f"⚠️  LLM service no disponible: {e}")
                self.llm_service = None

            # Initialize LanguageTool once (cache)
            if _LANG_TOOL_AVAILABLE and self.grammar_checker is None:
                try:
                    import language_tool_python  # type: ignore
                    lang = getattr(settings, 'language_tool_lang', 'es')
                    logger.info(f"🛠️  Inicializando LanguageTool para idioma: {lang}")
                    self.grammar_checker = language_tool_python.LanguageTool(lang)
                    logger.info("✅ LanguageTool inicializado y cacheado")
                except Exception as e:
                    logger.warning(f"⚠️  No se pudo inicializar LanguageTool: {e}")

            self._model_loaded = True
            logger.info("✅ Modelos de texto cargados (parcialmente si faltan dependencias opcionales)")
    
    async def evaluate_writing(
        self, 
        request: WritingEvaluationRequest
    ) -> WritingEvaluationResponse:
        """
        Evaluate a written text response
        """
        start_time = time.time()
        
        try:
            # Ensure models are loaded
            await self.initialize_models()
            
            logger.info(f"📝 Evaluando texto de {len(request.text)} caracteres para nivel {request.level}")
            
            # Analyze text metrics
            metrics = await self._analyze_text_metrics(request.text)
            
            # Calculate scores based on rubric and level
            scores = await self._calculate_writing_scores(
                request.text, 
                metrics, 
                request.level,
                request.rubric
            )
            
            # Generate feedback
            feedback = await self._generate_writing_feedback(
                metrics, 
                scores, 
                request.level,
                request.text
            )
            
            # Determine achieved level
            achieved_level = await self._determine_level_from_score(
                scores["total_score"], 
                scores["max_score"]
            )
            
            processing_time = time.time() - start_time
            
            return WritingEvaluationResponse(
                success=True,
                message="Evaluación de escritura completada",
                processing_time=processing_time,
                score=scores["total_score"],
                max_score=scores["max_score"],
                percentage=scores["percentage"],
                level_achieved=achieved_level,
                metrics=metrics,
                feedback=feedback["main_feedback"],
                recommendations=feedback["recommendations"],
                rubric_scores=scores["rubric_breakdown"],
                feedback_markdown=feedback.get("markdown")
            )
            
        except Exception as e:
            logger.error(f"❌ Error en evaluación de escritura: {e}")
            processing_time = time.time() - start_time
            return WritingEvaluationResponse(
                success=False,
                message=f"Error en evaluación: {str(e)}",
                processing_time=processing_time,
                score=0.0,
                max_score=100.0,
                percentage=0.0,
                level_achieved=MCERLevel.A1,
                metrics=TextMetrics(
                    word_count=0, sentence_count=0, paragraph_count=0,
                    avg_sentence_length=0.0, complexity_score=0.0,
                    readability_score=0.0, grammar_errors=[],
                    vocabulary_level="A1", lexical_diversity=0.0
                ),
                feedback="Error en el procesamiento del texto",
                recommendations=[],
                rubric_scores={},
                feedback_markdown=None
            )
    
    async def evaluate_reading(
        self, 
        request: ReadingEvaluationRequest
    ) -> Dict[str, Any]:
        """
        Evaluate reading comprehension responses
        """
        start_time = time.time()
        
        try:
            await self.initialize_models()
            
            logger.info(f"📖 Evaluando comprensión lectora - {len(request.questions)} preguntas")
            
            total_score = 0
            max_score = 0
            question_results = []
            
            for i, (question, answer) in enumerate(zip(request.questions, request.answers)):
                question_result = await self._evaluate_reading_question(
                    question, 
                    answer, 
                    request.text,
                    request.level
                )
                
                question_results.append(question_result)
                total_score += question_result["score"]
                max_score += question_result["max_score"]
            
            percentage = (total_score / max_score * 100) if max_score > 0 else 0
            achieved_level = await self._determine_level_from_score(total_score, max_score)
            
            processing_time = time.time() - start_time
            
            return {
                "success": True,
                "message": "Evaluación de comprensión lectora completada",
                "processing_time": processing_time,
                "total_score": total_score,
                "max_score": max_score,
                "percentage": percentage,
                "level_achieved": achieved_level,
                "question_results": question_results,
                "feedback": await self._generate_reading_feedback(question_results, achieved_level)
            }
            
        except Exception as e:
            logger.error(f"❌ Error en evaluación de lectura: {e}")
            return {
                "success": False,
                "message": f"Error en evaluación: {str(e)}",
                "processing_time": time.time() - start_time
            }
    
    async def _analyze_text_metrics(self, text: str) -> TextMetrics:
        """Analyze comprehensive text metrics"""
        doc = self.nlp(text)

        # Lightweight language detection (en vs es) using stopword ratio
        lang_detected = self._detect_language_simple(doc)
        if lang_detected and _LANG_TOOL_AVAILABLE and self.grammar_checker:
            # If LT language differs from detected, consider lazy re-init once
            try:
                current_lang = getattr(getattr(self.grammar_checker, 'language', None), 'normalized_tag', None)
                if current_lang and lang_detected.startswith('en') and not current_lang.startswith('en'):
                    import language_tool_python  # type: ignore
                    self.grammar_checker = language_tool_python.LanguageTool('en-US')
                elif current_lang and lang_detected.startswith('es') and not current_lang.startswith('es'):
                    import language_tool_python  # type: ignore
                    self.grammar_checker = language_tool_python.LanguageTool('es')
            except Exception as e:
                logger.warning(f"No se pudo reconfigurar LanguageTool al idioma detectado {lang_detected}: {e}")
        
        # Basic counts
        words = [token for token in doc if token.is_alpha and not token.is_stop]
        sentences = list(doc.sents)
        paragraphs = text.split('\n\n')
        
        # Calculate metrics
        word_count = len(words)
        sentence_count = len(sentences)
        paragraph_count = len([p for p in paragraphs if p.strip()])
        
        avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
        
        # Readability scores
        readability_score = flesch_reading_ease(text)
        
        # Complexity analysis
        complexity_score = await self._calculate_complexity_score(doc)
        
        # Grammar error detection - prefer LanguageTool on raw text
        grammar_errors = []
        try:
            result = await self._detect_grammar_errors(text)
            # _detect_grammar_errors may return (errors, annotated_text) or just errors
            if isinstance(result, tuple):
                grammar_errors = result[0]
            else:
                grammar_errors = result
        except Exception as e:
            logger.warning(f"Error detectando errores de gramática: {e}")
            grammar_errors = []
        
        # Vocabulary assessment
        vocabulary_level = await self._assess_vocabulary_level(words)
        
        # Lexical diversity (Type-Token Ratio)
        unique_words = len(set([token.lemma_.lower() for token in words]))
        lexical_diversity = unique_words / word_count if word_count > 0 else 0
        
        return TextMetrics(
            word_count=word_count,
            sentence_count=sentence_count,
            paragraph_count=paragraph_count,
            avg_sentence_length=avg_sentence_length,
            complexity_score=complexity_score,
            readability_score=readability_score,
            grammar_errors=grammar_errors,
            vocabulary_level=vocabulary_level,
            lexical_diversity=lexical_diversity,
            language_detected=lang_detected
        )

    def _detect_language_simple(self, doc) -> Optional[str]:
        """Very simple EN vs ES detection based on stopwords proportion."""
        if not doc:
            return None
        tokens = [t.text.lower() for t in doc if t.is_alpha]
        if not tokens:
            return None
        # Minimal stopword sets
        es_sw = {"el","la","los","las","un","una","de","que","y","en","se","no","por","con","para","es"}
        en_sw = {"the","a","an","and","in","on","is","are","was","were","to","of","for","with","that"}
        es_count = sum(1 for t in tokens if t in es_sw)
        en_count = sum(1 for t in tokens if t in en_sw)
        total = es_count + en_count
        if total == 0:
            return None
        ratio = es_count / total
        return 'es' if ratio >= 0.55 else 'en'
    
    async def _calculate_complexity_score(self, doc) -> float:
        """Calculate text complexity based on syntactic features"""
        complexity_features = 0
        total_tokens = len(doc)
        
        for token in doc:
            # Complex grammatical structures
            if token.dep_ in ["ccomp", "xcomp", "advcl", "relcl"]:
                complexity_features += 2
            elif token.dep_ in ["amod", "advmod"]:
                complexity_features += 1
            
            # Advanced POS tags
            if token.pos_ in ["AUX", "CCONJ", "SCONJ"]:
                complexity_features += 1
        
        # Normalize by text length
        complexity_score = (complexity_features / total_tokens * 100) if total_tokens > 0 else 0
        return min(complexity_score, 100.0)
    
    async def _detect_grammar_errors(self, text: str):
        """
        Detect grammar errors in `text`.
        If LanguageTool is available, returns (errors, annotated_text).
        Otherwise returns a list of GrammarError objects (heuristic).
        """
        errors: List[GrammarError] = []
        annotated_text = text
        # Prefer cached grammar_checker if available
        if _LANG_TOOL_AVAILABLE and self.grammar_checker:
            try:
                matches = self.grammar_checker.check(text)

                for m in matches:
                    start = int(m.offset)
                    end = int(m.offset + m.errorLength)
                    suggestion = m.replacements[0] if m.replacements else ''
                    errors.append(GrammarError(
                        text=text[start:end],
                        start=start,
                        end=end,
                        error_type=getattr(m, 'ruleId', 'grammar'),
                        suggestion=suggestion,
                        confidence=0.9
                    ))

                # Build a simple annotated text with inline suggestions (non-destructive)
                # Insert markers after each error (process in reverse order)
                for m in sorted(matches, key=lambda x: x.offset, reverse=True):
                    start = int(m.offset)
                    end = int(m.offset + m.errorLength)
                    rep = m.replacements[0] if m.replacements else ''
                    if rep:
                        annotated_text = annotated_text[:end] + f" [[-> {rep}]]" + annotated_text[end:]

                return errors, annotated_text
            except Exception as e:
                logger.warning(f"LanguageTool check failed (cache): {e}")
        elif _LANG_TOOL_AVAILABLE:
            # Fallback to ad-hoc instantiation if cache missing
            try:
                import language_tool_python  # type: ignore
                lang = getattr(settings, 'language_tool_lang', 'es')
                tool = language_tool_python.LanguageTool(lang)
                matches = tool.check(text)
                for m in matches:
                    start = int(m.offset)
                    end = int(m.offset + m.errorLength)
                    suggestion = m.replacements[0] if m.replacements else ''
                    errors.append(GrammarError(
                        text=text[start:end],
                        start=start,
                        end=end,
                        error_type=getattr(m, 'ruleId', 'grammar'),
                        suggestion=suggestion,
                        confidence=0.9
                    ))
                for m in sorted(matches, key=lambda x: x.offset, reverse=True):
                    start = int(m.offset)
                    end = int(m.offset + m.errorLength)
                    rep = m.replacements[0] if m.replacements else ''
                    if rep:
                        annotated_text = annotated_text[:end] + f" [[-> {rep}]]" + annotated_text[end:]
                return errors, annotated_text
            except Exception as e:
                logger.warning(f"LanguageTool check failed (on-demand): {e}")

        # Fallback heuristics when LanguageTool not available
        common = [
            (r"\bwe was\b", "use 'we were'"),
            (r"\bfinded\b", "use 'found'"),
            (r"\bdont\b", "use 'don't'"),
            (r"\bare dog\b", "possible article issue: 'our dog' vs 'are dog'"),
        ]

        for pattern, suggestion in common:
            for m in re.finditer(pattern, text, re.IGNORECASE):
                errors.append(GrammarError(
                    text=text[m.start():m.end()],
                    start=m.start(),
                    end=m.end(),
                    error_type="heuristic",
                    suggestion=suggestion,
                    confidence=0.5
                ))

        return errors
    
    def _check_agreement_error(self, subj, verb) -> bool:
        """Simple heuristic for subject-verb agreement"""
        # This is a simplified check - in production, use more sophisticated grammar checking
        singular_subjects = ["he", "she", "it"]
        plural_subjects = ["they", "we"]
        
        if subj.text.lower() in singular_subjects and verb.text.endswith("s"):
            return False
        elif subj.text.lower() in plural_subjects and verb.text.endswith("s"):
            return True
        
        return False
    
    async def _assess_vocabulary_level(self, words) -> str:
        """Assess vocabulary level based on word frequency and complexity"""
        if not words:
            return "A1"
        
        # Simple heuristic based on word length and frequency
        avg_word_length = sum(len(word.text) for word in words) / len(words)
        
        if avg_word_length < 4:
            return "A1"
        elif avg_word_length < 5:
            return "A2"  
        elif avg_word_length < 6:
            return "B1"
        elif avg_word_length < 7:
            return "B2"
        elif avg_word_length < 8:
            return "C1"
        else:
            return "C2"
    
    async def _calculate_writing_scores(
        self, 
        text: str, 
        metrics: TextMetrics, 
        level: MCERLevel,
        rubric: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate scores based on rubric criteria"""
        
        scores = {}
        max_scores = {}
        
        # Content and Task Achievement (30%)
        content_score = await self._score_content(text, metrics, level)
        scores["content"] = content_score
        max_scores["content"] = 30
        
        # Language Use and Grammar (25%)
        grammar_score = await self._score_grammar(metrics, level)
        scores["grammar"] = grammar_score
        max_scores["grammar"] = 25
        
        # Vocabulary and Lexical Resource (25%)
        vocabulary_score = await self._score_vocabulary(metrics, level)
        scores["vocabulary"] = vocabulary_score
        max_scores["vocabulary"] = 25
        
        # Organization and Coherence (20%)
        organization_score = await self._score_organization(text, metrics, level)
        scores["organization"] = organization_score
        max_scores["organization"] = 20
        
        total_score = sum(scores.values())
        max_score = sum(max_scores.values())
        percentage = (total_score / max_score * 100) if max_score > 0 else 0
        
        return {
            "rubric_breakdown": scores,
            "max_scores": max_scores,
            "total_score": total_score,
            "max_score": max_score,
            "percentage": percentage
        }
    
    async def _score_content(self, text: str, metrics: TextMetrics, level: MCERLevel) -> float:
        """Score content and task achievement"""
        base_score = 15  # Start with half points
        
        # Word count appropriateness for level
        level_word_ranges = {
            MCERLevel.A1: (50, 100),
            MCERLevel.A2: (80, 150), 
            MCERLevel.B1: (120, 200),
            MCERLevel.B2: (150, 250),
            MCERLevel.C1: (200, 300),
            MCERLevel.C2: (250, 400)
        }
        
        min_words, max_words = level_word_ranges.get(level, (100, 200))
        
        if min_words <= metrics.word_count <= max_words:
            base_score += 10
        elif metrics.word_count < min_words:
            base_score += max(0, 10 - (min_words - metrics.word_count) * 0.1)
        
        # Content complexity bonus
        if metrics.complexity_score > 30:
            base_score += 5
        
        return min(base_score, 30)
    
    async def _score_grammar(self, metrics: TextMetrics, level: MCERLevel) -> float:
        """Score grammar and language accuracy"""
        # Weighted penalties by error type (very coarse)
        if not metrics.grammar_errors:
            return 25.0
        weights = {
            'agreement': 3.5,
            'tense': 3.0,
            'spelling': 1.0,
            'morphology': 2.0,
            'heuristic': 1.5
        }
        total_penalty = 0.0
        for err in metrics.grammar_errors:
            et = getattr(err, 'error_type', '').lower()
            if 'MORFOLOGIK'.lower() in et or 'spell' in et:
                w = weights['spelling']
            elif 'agreement' in et:
                w = weights['agreement']
            elif 'tense' in et:
                w = weights['tense']
            elif 'morph' in et:
                w = weights['morphology']
            elif 'heuristic' in et:
                w = weights['heuristic']
            else:
                w = 2.0
            total_penalty += w
        # Scale to max 25
        score = max(0.0, 25.0 - total_penalty)
        # Mild bonus for longer accurate sentences (if few errors per sentence)
        if len(metrics.grammar_errors) / max(1, metrics.sentence_count) < 0.2 and metrics.avg_sentence_length > 12:
            score = min(25.0, score + 2.0)
        return score
    
    async def _score_vocabulary(self, metrics: TextMetrics, level: MCERLevel) -> float:
        """Score vocabulary usage"""
        base_score = 10
        
        # Lexical diversity bonus
        if metrics.lexical_diversity > 0.6:
            base_score += 10
        elif metrics.lexical_diversity > 0.4:
            base_score += 5
        
        # Vocabulary level match
        level_hierarchy = {
            MCERLevel.A1: 1, MCERLevel.A2: 2, MCERLevel.B1: 3,
            MCERLevel.B2: 4, MCERLevel.C1: 5, MCERLevel.C2: 6
        }
        
        vocab_level_score = level_hierarchy.get(MCERLevel(metrics.vocabulary_level), 1)
        target_level_score = level_hierarchy.get(level, 3)
        
        if vocab_level_score >= target_level_score:
            base_score += 5
        
        return min(base_score, 25)
    
    async def _score_organization(self, text: str, metrics: TextMetrics, level: MCERLevel) -> float:
        """Score text organization and coherence"""
        base_score = 8
        
        # Paragraph structure
        if metrics.paragraph_count > 1:
            base_score += 5
        
        # Sentence variety
        if metrics.sentence_count > 3 and metrics.avg_sentence_length > 10:
            base_score += 4
        
        # Cohesive devices detection (simple)
        cohesive_markers = ["however", "therefore", "moreover", "furthermore", "in addition", "on the other hand"]
        found_markers = sum(1 for marker in cohesive_markers if marker in text.lower())
        base_score += min(found_markers * 1, 3)
        
        return min(base_score, 20)
    
    async def _generate_writing_feedback(
        self, 
        metrics: TextMetrics, 
        scores: Dict[str, Any],
        level: MCERLevel,
        original_text: str = ""
    ) -> Dict[str, Any]:
        """Generate personalized feedback with LLM enhancement"""
        
        # Traditional feedback (backup)
        traditional_feedback = await self._generate_traditional_feedback(metrics, scores, level)
        
        # Try LLM enhancement if available
        if self.llm_service and self.llm_service.enabled:
            try:
                # Prepare issues structure for LLM: convert GrammarError -> dict
                issues = []
                for err in metrics.grammar_errors[:10]:
                    try:
                        issues.append({
                            "start": int(err.start),
                            "end": int(err.end),
                            "text": getattr(err, 'text', ''),
                            "suggestion": getattr(err, 'suggestion', '')
                        })
                    except Exception:
                        continue

                annotated = getattr(metrics, 'annotated_text', original_text)

                # La firma actual de generate_personalized_feedback solo acepta (text, score, level_achieved, errors, target_level)
                # Empaquetamos info adicional en los primeros errores para orientar al modelo (simple hack)
                augmented_errors = [e.get('text','') for e in issues]
                if annotated and annotated != original_text:
                    augmented_errors = [f"ANNOTATED:{annotated[:180]}"] + augmented_errors
                llm_result = await self.llm_service.generate_personalized_feedback(
                    text=original_text,
                    score=scores["percentage"],
                    level_achieved=level.value,
                    errors=augmented_errors,
                    target_level=level.value
                )
                
                if llm_result.get("enhanced", False):
                    # Use markdown principal si existe
                    markdown_text = llm_result.get("markdown")
                    main_fb = llm_result.get("feedback") or traditional_feedback["main_feedback"]
                    recs = llm_result.get("suggestions", traditional_feedback["recommendations"])
                    return {
                        "main_feedback": main_fb,
                        "recommendations": recs,
                        "enhanced_by_llm": True,
                        "model_used": llm_result.get("model_used", "ollama"),
                        "markdown": markdown_text
                    }
                    
            except Exception as e:
                logger.warning(f"⚠️  Error con LLM, usando feedback tradicional: {e}")
        
        # Fallback to traditional feedback
        return {
            **traditional_feedback,
            "enhanced_by_llm": False,
            "model_used": "traditional_nlp",
            "markdown": None
        }
    
    async def _generate_traditional_feedback(
        self, 
        metrics: TextMetrics, 
        scores: Dict[str, Any],
        level: MCERLevel
    ) -> Dict[str, Any]:
        """Generate traditional rule-based feedback"""
        
        feedback_parts = []
        recommendations = []
        
        # Overall performance
        percentage = scores["percentage"]
        if percentage >= 80:
            feedback_parts.append("Excelente trabajo. Tu escritura demuestra un buen dominio del idioma.")
        elif percentage >= 60:
            feedback_parts.append("Buen trabajo. Tu escritura muestra competencia en el nivel evaluado.")
        else:
            feedback_parts.append("Tu escritura necesita mejoras para alcanzar el nivel esperado.")
        
        # Specific feedback based on scores
        if scores["rubric_breakdown"]["grammar"] < 15:
            feedback_parts.append("Presta atención a la gramática y estructura de las oraciones.")
            recommendations.append("Revisa las reglas básicas de gramática y practica con ejercicios estructurados.")
        
        if scores["rubric_breakdown"]["vocabulary"] < 15:
            feedback_parts.append("Amplía tu vocabulario para expresarte con mayor precisión.")
            recommendations.append("Lee textos variados y mantén un registro de palabras nuevas.")
        
        if scores["rubric_breakdown"]["organization"] < 12:
            feedback_parts.append("Mejora la organización y coherencia de tus ideas.")
            recommendations.append("Usa conectores y organiza tus ideas en párrafos claros.")
        
        # Positive reinforcement
        if metrics.lexical_diversity > 0.6:
            feedback_parts.append("Tu uso variado del vocabulario es destacable.")
        
        if len(metrics.grammar_errors) <= 2:
            feedback_parts.append("Tu precisión gramatical es buena.")
        
        return {
            "main_feedback": " ".join(feedback_parts),
            "recommendations": recommendations
        }
    
    async def _determine_level_from_score(self, score: float, max_score: float) -> MCERLevel:
        """Determine MCER level based on score percentage"""
        percentage = (score / max_score * 100) if max_score > 0 else 0
        
        if percentage >= 85:
            return MCERLevel.C2
        elif percentage >= 75:
            return MCERLevel.C1
        elif percentage >= 65:
            return MCERLevel.B2
        elif percentage >= 55:
            return MCERLevel.B1
        elif percentage >= 40:
            return MCERLevel.A2
        else:
            return MCERLevel.A1
    
    async def _evaluate_reading_question(
        self, 
        question: Dict[str, Any], 
        answer: Dict[str, Any], 
        context: str,
        level: MCERLevel
    ) -> Dict[str, Any]:
        """Evaluate individual reading comprehension question"""
        
        question_type = question.get("type", "multiple_choice")
        
        if question_type == "multiple_choice":
            return await self._evaluate_multiple_choice(question, answer)
        elif question_type == "open_ended":
            return await self._evaluate_open_ended(question, answer, context)
        elif question_type == "true_false":
            return await self._evaluate_true_false(question, answer)
        else:
            return {
                "score": 0,
                "max_score": 1,
                "feedback": "Tipo de pregunta no reconocido"
            }
    
    async def _evaluate_multiple_choice(self, question: Dict, answer: Dict) -> Dict:
        """Evaluate multiple choice question"""
        correct_answer = question.get("correct_answer")
        given_answer = answer.get("selected_option")
        
        score = 1 if correct_answer == given_answer else 0
        
        return {
            "score": score,
            "max_score": 1,
            "correct": score == 1,
            "feedback": "Correcto" if score == 1 else f"Respuesta correcta: {correct_answer}"
        }
    
    async def _evaluate_open_ended(self, question: Dict, answer: Dict, context: str) -> Dict:
        """Evaluate open-ended question using text similarity"""
        # This would use more sophisticated NLP in production
        given_answer = answer.get("text", "").lower()
        expected_keywords = question.get("keywords", [])
        
        score = 0
        for keyword in expected_keywords:
            if keyword.lower() in given_answer:
                score += 1
        
        max_score = len(expected_keywords)
        percentage = (score / max_score) if max_score > 0 else 0
        
        return {
            "score": percentage,
            "max_score": 1,
            "correct": percentage > 0.6,
            "feedback": f"Respuesta parcialmente correcta ({percentage:.1%})" if percentage > 0 else "Respuesta incorrecta"
        }
    
    async def _evaluate_true_false(self, question: Dict, answer: Dict) -> Dict:
        """Evaluate true/false question"""
        correct_answer = question.get("correct_answer")
        given_answer = answer.get("answer")
        
        score = 1 if correct_answer == given_answer else 0
        
        return {
            "score": score,
            "max_score": 1,
            "correct": score == 1,
            "feedback": "Correcto" if score == 1 else f"Respuesta correcta: {correct_answer}"
        }
    
    async def _generate_reading_feedback(self, results: List[Dict], level: MCERLevel) -> str:
        """Generate feedback for reading comprehension"""
        total_correct = sum(1 for r in results if r.get("correct", False))
        total_questions = len(results)
        percentage = (total_correct / total_questions * 100) if total_questions > 0 else 0
        
        if percentage >= 80:
            return f"Excelente comprensión lectora ({total_correct}/{total_questions} correctas). Dominas bien este nivel."
        elif percentage >= 60:
            return f"Buena comprensión lectora ({total_correct}/{total_questions} correctas). Continúa practicando."
        else:
            return f"Necesitas mejorar tu comprensión lectora ({total_correct}/{total_questions} correctas). Practica más con textos de este nivel."
    
    def is_model_loaded(self) -> bool:
        """Check if models are loaded"""
        return self._model_loaded
