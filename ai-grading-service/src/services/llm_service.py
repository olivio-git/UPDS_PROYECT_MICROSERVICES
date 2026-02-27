"""
LLM Service - Implementación con Ollama Local
Modelos locales cuantizados para feedback personalizado
Version optimizada para feedback conciso y directo
"""
import aiohttp
import asyncio
import logging
from typing import Dict, Any, Optional, List, Literal
import json
from enum import Enum
from ..config.settings import settings
import re
import html

logger = logging.getLogger(__name__)

class FeedbackLanguage(Enum):
    """Idiomas soportados para el feedback"""
    SPANISH = "spanish"
    ENGLISH = "english"

class FeedbackLength(Enum):
    """Longitud del feedback"""
    BRIEF = "brief"      # 1-2 oraciones
    NORMAL = "normal"    # 2-3 oraciones
    DETAILED = "detailed" # 3-5 oraciones

class FeedbackFormat(Enum):
    """Formato de salida preferido"""
    JSON = "json"
    MARKDOWN = "markdown"
    HYBRID = "hybrid"  # ambos: json + markdown

class LocalLLMService:
    """
    Service for local LLM evaluation using Ollama
    Enfocado en FEEDBACK personalizado y CONCISO
    """
    
    def __init__(
        self, 
        feedback_language: FeedbackLanguage = FeedbackLanguage.SPANISH,
        feedback_length: FeedbackLength = FeedbackLength.BRIEF,
        feedback_format: FeedbackFormat = FeedbackFormat.MARKDOWN
    ):
        self.ollama_url = settings.ollama_url  # http://host.docker.internal:11434
        self.model_name = settings.ollama_model  # qwen2.5:1.5b-instruct-q4_0
        self.enabled = settings.llm_enabled  # False por defecto
        self.session = None
        self.feedback_language = feedback_language
        self.feedback_length = feedback_length
        # Allow override from settings if not explicitly passed (environment wins)
        fmt_from_env = getattr(settings, 'llm_feedback_format', None)
        if fmt_from_env:
            fmt_lower = str(fmt_from_env).lower()
            if fmt_lower in ('markdown','md'):
                self.feedback_format = FeedbackFormat.MARKDOWN
            elif fmt_lower in ('json',):
                self.feedback_format = FeedbackFormat.JSON
            elif fmt_lower in ('hybrid','both'):
                self.feedback_format = FeedbackFormat.HYBRID
            else:
                self.feedback_format = feedback_format
        else:
            self.feedback_format = feedback_format
        
    async def initialize(self):
        """Initialize Ollama connection"""
        if not self.enabled:
            logger.info("🚫 LLM local deshabilitado por configuración")
            return
            
        try:
            # Test Ollama connection
            self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
            
            # Check if Ollama is running
            async with self.session.get(f"{self.ollama_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models = [model['name'] for model in data.get('models', [])]
                    
                    if self.model_name in models:
                        logger.info(f"✅ Ollama conectado - Modelo: {self.model_name}")
                    else:
                        logger.warning(f"⚠️  Modelo {self.model_name} no encontrado. Disponibles: {models}")
                        # Usar el primer modelo disponible como fallback
                        if models:
                            self.model_name = models[0]
                            logger.info(f"🔄 Usando modelo fallback: {self.model_name}")
                else:
                    raise Exception(f"Ollama no responde: {response.status}")
                    
        except Exception as e:
            logger.error(f"❌ Error conectando a Ollama: {e}")
            logger.info("💡 Asegúrate de que Ollama esté ejecutándose: ollama serve")
            self.enabled = False
            if self.session:
                await self.session.close()
    
    async def close(self):
        """Close session"""
        if self.session:
            await self.session.close()

    async def generate(self, prompt: str) -> str:
        """
        Generic text generation method for question generation
        """
        if not self.enabled or not self.session:
            raise Exception("LLM service not available or not initialized")

        try:
            logger.debug(f"🔧 Enviando prompt al LLM (longitud: {len(prompt)} chars)")
            logger.debug(f"🔧 Prompt preview: {prompt[:300]}...")

            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": getattr(settings, 'llm_temperature', 0.7),  # Balanced creativity
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_predict": 400,  # Much shorter for faster generation
                    "repeat_penalty": 1.1  # Standard penalty
                }
            }

            async with self.session.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=getattr(settings, 'llm_timeout', 90))
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get('response', '').strip()
                    logger.debug(f"✅ LLM respuesta recibida (longitud: {len(response_text)} chars)")
                    if not response_text:
                        logger.warning("⚠️  LLM devolvió respuesta vacía")
                        raise Exception("Empty response from LLM")
                    return response_text
                else:
                    response_text = await response.text()
                    logger.error(f"❌ Ollama API error {response.status}: {response_text}")
                    raise Exception(f"Ollama API returned status {response.status}: {response_text}")

        except asyncio.TimeoutError:
            logger.error("❌ Timeout esperando respuesta del LLM")
            raise Exception("LLM request timeout")
        except Exception as e:
            logger.error(f"❌ Error completo en generación: {str(e)}")
            raise Exception(f"Text generation failed: {str(e)}")

    async def _generate_text(self, prompt: str) -> str:
        """
        Alias for generate method for backward compatibility
        """
        return await self.generate(prompt)
    
    def _build_feedback_prompt(
        self, 
        text: str, 
        score: float,
        level_achieved: str,
        errors: List[str],
        target_level: str = "B2",
        annotated_text: str = "",
        issues: Optional[List[Dict[str, Any]]] = None,
        metrics: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Construye un prompt optimizado para feedback CONCISO
        """
        # Texto muy limitado para contexto
        text_excerpt = (annotated_text[:300] if annotated_text else (text[:200] if len(text) > 200 else text))

        # Solo los errores más importantes
        main_errors = errors[:2] if errors else ["Sin errores graves"]

        # Configuración de longitud
        if self.feedback_length == FeedbackLength.BRIEF:
            length_instruction = "máximo 2 oraciones cortas" if self.feedback_language == FeedbackLanguage.SPANISH else "maximum 2 short sentences"
            max_tokens = 60
        elif self.feedback_length == FeedbackLength.NORMAL:
            length_instruction = "máximo 3 oraciones" if self.feedback_language == FeedbackLanguage.SPANISH else "maximum 3 sentences"
            max_tokens = 100
        else:  # DETAILED
            length_instruction = "máximo 5 oraciones" if self.feedback_language == FeedbackLanguage.SPANISH else "maximum 5 sentences"
            max_tokens = 150

        # Build prompt depending on format desired
        if self.feedback_format == FeedbackFormat.MARKDOWN:
            if self.feedback_language == FeedbackLanguage.SPANISH:
                prompt = f"""Eres un profesor de idiomas.
Genera feedback en formato Markdown, conciso ({length_instruction}).

Incluye:
1. Encabezado con puntuación y nivel.
2. Breve resumen (1 frase).
3. Lista de 2-4 acciones concretas.
4. Tabla (| Texto | Sugerencia |) solo si hay errores.
5. Reescritura sugerida (máx 2 oraciones) en bloque citado.

PUNTUACIÓN: {score:.0f}/100 (Nivel {level_achieved})
ERRORES PRINCIPALES: {', '.join(main_errors)}
EXTRACTO: {text_excerpt}

No incluyas JSON. Solo Markdown limpio.
"""
            else:
                prompt = f"""You are a language teacher.
Produce concise Markdown feedback ({length_instruction}).

Include:
1. Heading with score and level.
2. One-sentence summary.
3. 2-4 bullet actions.
4. Table (| Text | Suggestion |) only if errors exist.
5. Suggested rewrite (max 2 sentences) as a quote.

SCORE: {score:.0f}/100 (Level {level_achieved})
MAIN ERRORS: {', '.join(main_errors)}
EXCERPT: {text_excerpt}

No JSON. Only clean Markdown.
"""
        else:
            # JSON or HYBRID keep previous structured JSON prompt
            if self.feedback_language == FeedbackLanguage.SPANISH:
                prompt = f"""Eres un profesor evaluando un examen. Sé DIRECTO y CONCISO.

RESULTADO: {score:.0f}/100 (Nivel {level_achieved})
ERRORES PRINCIPALES: {', '.join(main_errors)}

Contexto (extracto): {text_excerpt}
Si hay texto anotado con sugerencias, úsalo para localizar problemas.

Incluye en la respuesta un objeto JSON con la siguiente estructura EXACTA (sin explicaciones adicionales):
{{
    \"feedback\": \"string breve - evaluación general\",
    \"issues\": [{{\"start\": int, \"end\": int, \"text\": \"span\", \"suggestion\": \"string\"}}],
    \"suggested_rewrite\": \"string con una versión corregida (máximo 2 oraciones)\",
    \"actions\": [\"lista de acciones concretas para mejorar\" ]
}}

Da feedback en {length_instruction}.

FEEDBACK_JSON:"""
            else:
                prompt = f"""You are a teacher grading an exam. Be DIRECT and CONCISE.

RESULT: {score:.0f}/100 (Level {level_achieved})
MAIN ERRORS: {', '.join(main_errors)}

Context (excerpt): {text_excerpt}
If annotated text with suggestions is available, use it to locate issues.

Return a JSON object ONLY, with this exact schema:
{{
    \"feedback\": \"brief assessment string\",
    \"issues\": [{{\"start\": int, \"end\": int, \"text\": \"span\", \"suggestion\": \"string\"}}],
    \"suggested_rewrite\": \"corrected short rewrite (max 2 sentences)\",
    \"actions\": [\"concrete action items to improve\"]
}}

Give feedback in {length_instruction}.

FEEDBACK_JSON:"""

        return prompt, max_tokens
    
    async def generate_personalized_feedback(
        self, 
        text: str, 
        score: float,
        level_achieved: str,
        errors: List[str],
        target_level: str = "B2"
    ) -> Dict[str, Any]:
        """
        Generate CONCISE personalized feedback
        """
        if not self.enabled or not self.session:
            return self._fallback_feedback(score, level_achieved, errors)
            
        try:
            # Construir prompt y obtener max_tokens
            prompt, max_tokens = self._build_feedback_prompt(
                text, score, level_achieved, errors, target_level
            )
            
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": getattr(settings, 'llm_temperature', 0.3),
                    "top_p": 0.9,
                    "top_k": 30,
                    "num_predict": max_tokens,
                    "repeat_penalty": 1.1,
                    "stop": ["\n\n", "---", "###"]
                }
            }
            
            async with self.session.post(
                f"{self.ollama_url}/api/generate", 
                json=payload,
                timeout=aiohttp.ClientTimeout(total=getattr(settings, 'llm_timeout', 20))
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    raw = data.get('response', '') or ''
                    feedback_text = raw.strip()
                    if self.feedback_format == FeedbackFormat.MARKDOWN:
                        cleaned_md = self._sanitize_field(feedback_text)
                        # First line or sentence becomes short feedback
                        first_line = cleaned_md.split('\n',1)[0].strip()
                        summary = first_line[:220]
                        return {
                            "feedback": summary,
                            "markdown": cleaned_md,
                            "model_used": self.model_name,
                            "enhanced": True,
                            "sanitized": True,
                            "language": self.feedback_language.value,
                            "length": self.feedback_length.value,
                            "format": self.feedback_format.value
                        }
                    # Sanitize / extract JSON safely (JSON / HYBRID)
                    json_obj = self._extract_json_payload(feedback_text) if self.feedback_format != FeedbackFormat.MARKDOWN else None
                    if json_obj is not None:
                        feedback_val = self._sanitize_field(json_obj.get('feedback', ''))
                        issues_val = json_obj.get('issues', [])
                        if not isinstance(issues_val, list):
                            issues_val = []
                        # Coerce each issue to minimal shape
                        norm_issues = []
                        for it in issues_val[:15]:
                            if isinstance(it, dict):
                                norm_issues.append({
                                    'start': int(it.get('start', 0)),
                                    'end': int(it.get('end', 0)),
                                    'text': self._truncate(self._sanitize_field(str(it.get('text',''))), 120),
                                    'suggestion': self._truncate(self._sanitize_field(str(it.get('suggestion',''))), 120)
                                })
                        suggested = self._truncate(self._sanitize_field(json_obj.get('suggested_rewrite', '')), 240)
                        actions = json_obj.get('actions', [])
                        if not isinstance(actions, list):
                            actions = []
                        actions = [self._truncate(self._sanitize_field(str(a)), 100) for a in actions[:8]]
                        base = {
                            "feedback": self._clean_feedback(feedback_val),
                            "issues": norm_issues,
                            "suggested_rewrite": suggested,
                            "actions": actions,
                            "model_used": self.model_name,
                            "enhanced": True,
                            "sanitized": True,
                            "language": self.feedback_language.value,
                            "length": self.feedback_length.value,
                            "format": self.feedback_format.value
                        }
                        if self.feedback_format in (FeedbackFormat.MARKDOWN, FeedbackFormat.HYBRID):
                            base["markdown"] = self._to_markdown(score, level_achieved, base["feedback"], norm_issues, suggested, actions)
                        return base
                    # JSON not extracted -> fallback short
                    cleaned = self._clean_feedback(self._sanitize_field(feedback_text))
                    # Intentar segunda extracción si el texto parece contener JSON embebido
                    repaired_json = self._attempt_inline_json(cleaned)
                    if repaired_json is not None:
                        return self._package_json_result(repaired_json)
                    main_suggestion = self._extract_main_suggestion(cleaned, errors)
                    base = {
                        "feedback": cleaned,
                        "suggestions": [main_suggestion] if main_suggestion else [],
                        "model_used": self.model_name,
                        "enhanced": True,
                        "sanitized": True,
                        "language": self.feedback_language.value,
                        "length": self.feedback_length.value,
                        "format": self.feedback_format.value
                    }
                    if self.feedback_format in (FeedbackFormat.MARKDOWN, FeedbackFormat.HYBRID):
                        base["markdown"] = self._to_markdown(score, level_achieved, cleaned, [], "", base.get("suggestions", []))
                    return base
                else:
                    logger.error(f"Error Ollama: {response.status}")
                    return self._fallback_feedback(score, level_achieved, errors)
                    
        except asyncio.TimeoutError:
            logger.error("⏱️ Timeout generando feedback")
            return self._fallback_feedback(score, level_achieved, errors)
        except Exception as e:
            logger.error(f"❌ Error generando feedback: {e}")
            return self._fallback_feedback(score, level_achieved, errors)
    
    async def analyze_coherence(
        self, 
        text: str, 
        level: str = "B2"
    ) -> Dict[str, Any]:
        """
        Quick coherence score - just a number and brief reason
        """
        if not self.enabled:
            return {"coherence_score": 75, "analysis": "Coherencia adecuada"}
            
        try:
            lang = "español" if self.feedback_language == FeedbackLanguage.SPANISH else "English"
            
            prompt = f"""Rate text coherence 1-10 for level {level}.
Text: "{text[:150]}"
Answer in {lang}: [score]/10 - [reason in 5 words max]
RATING:"""

            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 30,  # Super corto
                    "seed": 42
                }
            }
            
            async with self.session.post(
                f"{self.ollama_url}/api/generate", 
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    analysis = data.get('response', '').strip()
                    score = self._extract_coherence_score(analysis)
                    
                    return {
                        "coherence_score": score,
                        "analysis": analysis[:50],  # Limitar longitud
                        "enhanced": True
                    }
                    
        except Exception as e:
            logger.error(f"Error coherencia: {e}")
            
        return {"coherence_score": 75, "analysis": "Coherencia adecuada"}
    
    def _clean_feedback(self, feedback: str) -> str:
        """
        Limpia y acorta el feedback si es necesario
        """
        # Eliminar saltos de línea múltiples
        feedback = ' '.join(feedback.split())
        
        # Limitar por oraciones según configuración
        sentences = feedback.split('. ')
        
        if self.feedback_length == FeedbackLength.BRIEF:
            max_sentences = 2
        elif self.feedback_length == FeedbackLength.NORMAL:
            max_sentences = 3
        else:
            max_sentences = 5
        
        # Tomar solo las primeras N oraciones
        if len(sentences) > max_sentences:
            sentences = sentences[:max_sentences]
            feedback = '. '.join(sentences)
            if not feedback.endswith('.'):
                feedback += '.'
        
        return feedback

    def _strip_code_fences(self, text: str) -> str:
        pattern = r"```(?:json|JSON)?\s*([\s\S]*?)```"
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
        return text

    def _find_json_braces(self, text: str) -> Optional[str]:
        # Find first balanced { } block
        start_idx = text.find('{')
        if start_idx == -1:
            return None
        depth = 0
        for i, ch in enumerate(text[start_idx:], start=start_idx):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return text[start_idx:i+1]
        return None

    def _extract_json_payload(self, raw: str) -> Optional[Dict[str, Any]]:
        candidate = self._strip_code_fences(raw)
        # Remove leading explanatory text before first '{'
        brace_json = self._find_json_braces(candidate)
        if not brace_json:
            return None
        try:
            return json.loads(brace_json)
        except Exception:
            # Try to unescape common artifacts
            cleaned = brace_json.replace('\n', ' ').replace('\t',' ')
            try:
                return json.loads(cleaned)
            except Exception:
                return None

    def _attempt_inline_json(self, text: str) -> Optional[Dict[str, Any]]:
        """If the cleaned fallback feedback still contains an inline JSON object, extract it.
        Handles double-encoded JSON strings and objects inside quotes.
        """
        # Fast check
        if '"feedback"' not in text and '"issues"' not in text:
            return None
        # If text starts/ends with quotes and contains escaped braces, unescape first
        candidate = text.strip()
        # Remove surrounding quotes if they wrap the whole object string
        if (candidate.startswith('"') and candidate.endswith('"')) or (candidate.startswith("'") and candidate.endswith("'")):
            inner = candidate[1:-1]
            # Try decoding escaped quotes
            try:
                # If it contains \" then attempt json.loads to unescape
                if '\\"' in inner:
                    unescaped = json.loads(candidate)  # becomes inner string
                    candidate = unescaped
                else:
                    candidate = inner
            except Exception:
                pass
        brace = self._find_json_braces(candidate)
        if not brace:
            return None
        try:
            obj = json.loads(brace)
            return obj if isinstance(obj, dict) else None
        except Exception:
            # Attempt minor repairs: strip trailing incomplete tokens
            repaired = re.sub(r',\s*([}\]])', r'\1', brace)  # remove dangling commas
            # close unclosed quotes heuristic not attempted (risky)
            try:
                obj = json.loads(repaired)
                return obj if isinstance(obj, dict) else None
            except Exception:
                return None

    def _package_json_result(self, json_obj: Dict[str, Any]) -> Dict[str, Any]:
        feedback_val = self._sanitize_field(json_obj.get('feedback', ''))
        issues_val = json_obj.get('issues', [])
        if not isinstance(issues_val, list):
            issues_val = []
        norm_issues = []
        for it in issues_val[:15]:
            if isinstance(it, dict):
                norm_issues.append({
                    'start': int(it.get('start', 0)),
                    'end': int(it.get('end', 0)),
                    'text': self._truncate(self._sanitize_field(str(it.get('text',''))), 120),
                    'suggestion': self._truncate(self._sanitize_field(str(it.get('suggestion',''))), 120)
                })
        suggested = self._truncate(self._sanitize_field(json_obj.get('suggested_rewrite', '')), 240)
        actions = json_obj.get('actions', [])
        if not isinstance(actions, list):
            actions = []
        actions = [self._truncate(self._sanitize_field(str(a)), 100) for a in actions[:8]]
        base = {
            "feedback": self._clean_feedback(feedback_val),
            "issues": norm_issues,
            "suggested_rewrite": suggested,
            "actions": actions,
            "model_used": self.model_name,
            "enhanced": True,
            "sanitized": True,
            "language": self.feedback_language.value,
            "length": self.feedback_length.value,
            "format": self.feedback_format.value
        }
        if self.feedback_format in (FeedbackFormat.MARKDOWN, FeedbackFormat.HYBRID):
            base["markdown"] = self._to_markdown(0, "", base["feedback"], norm_issues, suggested, actions)
        return base

    def _sanitize_field(self, val: str) -> str:
        # Basic sanitization: strip control chars, escape HTML
        val = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", val)
        val = html.unescape(val)
        return val.strip()

    def _truncate(self, val: str, max_len: int) -> str:
        return val if len(val) <= max_len else val[:max_len-1] + '…'
    
    def _extract_main_suggestion(self, feedback: str, errors: List[str]) -> str:
        """
        Extrae UNA sugerencia principal del feedback
        """
        if self.feedback_language == FeedbackLanguage.SPANISH:
            # Buscar frases con verbos de acción
            action_phrases = [
                "practica", "mejora", "revisa", "enfócate en", 
                "trabaja en", "estudia", "corrige"
            ]
            
            feedback_lower = feedback.lower()
            for phrase in action_phrases:
                if phrase in feedback_lower:
                    # Extraer la oración que contiene la acción
                    sentences = feedback.split('.')
                    for sentence in sentences:
                        if phrase in sentence.lower():
                            suggestion = sentence.strip()
                            if len(suggestion) > 10:
                                return suggestion.capitalize()
            
            # Fallback basado en errores
            if errors and len(errors) > 0:
                return f"Practica: {errors[0]}"
            return "Continúa practicando regularmente"
            
        else:  # ENGLISH
            action_phrases = [
                "practice", "improve", "review", "focus on", 
                "work on", "study", "correct"
            ]
            
            feedback_lower = feedback.lower()
            for phrase in action_phrases:
                if phrase in feedback_lower:
                    sentences = feedback.split('.')
                    for sentence in sentences:
                        if phrase in sentence.lower():
                            suggestion = sentence.strip()
                            if len(suggestion) > 10:
                                return suggestion.capitalize()
            
            if errors and len(errors) > 0:
                return f"Practice: {errors[0]}"
            return "Continue practicing regularly"
    
    def _extract_coherence_score(self, analysis: str) -> int:
        """Extract numeric score from coherence analysis"""
        import re
        
        # Buscar cualquier número del 1-10
        match = re.search(r'(\d+(?:\.\d+)?)\s*/?\s*10', analysis)
        if match:
            score = float(match.group(1))
            return int(score * 10) if score <= 10 else int(score)
        
        # Buscar número solo
        match = re.search(r'\b([1-9]|10)\b', analysis)
        if match:
            return int(match.group(1)) * 10
            
        return 75  # Default
    
    def _fallback_feedback(self, score: float, level: str, errors: List[str]) -> Dict[str, Any]:
        """
        Fallback CONCISO cuando no hay LLM
        """
        if self.feedback_language == FeedbackLanguage.SPANISH:
            if score >= 80:
                feedback = f"Excelente trabajo ({score:.0f}/100). Nivel {level} dominado."
                suggestion = "Mantén este nivel de calidad"
            elif score >= 60:
                feedback = f"Buen progreso ({score:.0f}/100). Nivel {level} en desarrollo."
                suggestion = f"Practica: {errors[0] if errors else 'vocabulario avanzado'}"
            else:
                feedback = f"Necesitas mejorar ({score:.0f}/100). Nivel {level} requiere más práctica."
                suggestion = f"Enfócate en: {errors[0] if errors else 'gramática básica'}"
        else:
            if score >= 80:
                feedback = f"Excellent work ({score:.0f}/100). Level {level} mastered."
                suggestion = "Maintain this quality level"
            elif score >= 60:
                feedback = f"Good progress ({score:.0f}/100). Level {level} developing."
                suggestion = f"Practice: {errors[0] if errors else 'advanced vocabulary'}"
            else:
                feedback = f"Needs improvement ({score:.0f}/100). Level {level} requires more practice."
                suggestion = f"Focus on: {errors[0] if errors else 'basic grammar'}"
        
        base = {
            "feedback": feedback,
            "suggestions": [suggestion],
            "model_used": "traditional_nlp",
            "enhanced": False,
            "language": self.feedback_language.value,
            "length": self.feedback_length.value,
            "format": self.feedback_format.value
        }
        if self.feedback_format in (FeedbackFormat.MARKDOWN, FeedbackFormat.HYBRID):
            base["markdown"] = self._to_markdown(score, level, feedback, [], "", base["suggestions"])
        return base

    def _to_markdown(self, score: float, level: str, feedback: str, issues: List[Dict[str, Any]], suggested_rewrite: str, actions: List[str]) -> str:
        """Construye bloque markdown seguro."""
        lines: List[str] = []
        if score or level:
            if level:
                lines.append(f"### Resultado {score:.0f}/100 - Nivel {level}" if self.feedback_language == FeedbackLanguage.SPANISH else f"### Result {score:.0f}/100 - Level {level}")
            else:
                lines.append(f"### Resultado {score:.0f}/100" if self.feedback_language == FeedbackLanguage.SPANISH else f"### Result {score:.0f}/100")
        if feedback:
            lines.append("")
            lines.append(feedback)
        if actions:
            lines.append("")
            lines.append("**Acciones:**" if self.feedback_language == FeedbackLanguage.SPANISH else "**Actions:**")
            for a in actions[:8]:
                lines.append(f"- {a}")
        if issues:
            lines.append("")
            lines.append("**Problemas detectados:**" if self.feedback_language == FeedbackLanguage.SPANISH else "**Detected Issues:**")
            lines.append("| Texto | Sugerencia |")
            lines.append("|-------|------------|")
            for it in issues[:6]:
                txt = (it.get('text','') or '').replace('|','\\|')
                sug = (it.get('suggestion','') or '').replace('|','\\|')
                lines.append(f"| {txt} | {sug} |")
        if suggested_rewrite:
            lines.append("")
            lines.append("**Reescritura sugerida:**" if self.feedback_language == FeedbackLanguage.SPANISH else "**Suggested Rewrite:**")
            lines.append("")
            lines.append(f"> {suggested_rewrite}")
        return "\n".join(lines).strip()

# Utility functions for integration
async def enhance_feedback_with_llm(
    traditional_feedback: str,
    text: str, 
    score: float,
    level: str,
    errors: List[str],
    target_level: str = "B2",
    language: FeedbackLanguage = FeedbackLanguage.SPANISH,
    length: FeedbackLength = FeedbackLength.BRIEF
) -> Dict[str, Any]:
    """
    Enhance traditional feedback with CONCISE LLM insights
    """
    llm_service = LocalLLMService(
        feedback_language=language,
        feedback_length=length
    )
    await llm_service.initialize()
    
    try:
        if llm_service.enabled:
            # Get LLM enhancement
            llm_result = await llm_service.generate_personalized_feedback(
                text, score, level, errors, target_level
            )
            
            # Para feedback breve, solo usar el LLM
            if length == FeedbackLength.BRIEF:
                return llm_result
            else:
                # Combinar si es más detallado
                combined = f"{traditional_feedback} | {llm_result['feedback']}"
                return {
                    "feedback": combined,
                    "suggestions": llm_result.get('suggestions', []),
                    "enhanced": True,
                    "model_used": llm_result.get('model_used', 'unknown'),
                    "language": language.value,
                    "length": length.value
                }
        else:
            return llm_service._fallback_feedback(score, level, errors)
            
    finally:
        await llm_service.close()

# Quick evaluation function for exams
async def get_quick_feedback(
    score: float,
    level: str,
    errors: List[str],
    language: str = "spanish"
) -> str:
    """
    Función rápida para obtener feedback de una línea
    Ideal para exámenes con múltiples preguntas
    """
    lang = FeedbackLanguage.SPANISH if language == "spanish" else FeedbackLanguage.ENGLISH
    
    llm_service = LocalLLMService(
        feedback_language=lang,
        feedback_length=FeedbackLength.BRIEF
    )
    
    result = llm_service._fallback_feedback(score, level, errors)
    return result["feedback"]

# Configuración adicional para settings.py
class LLMSettings:
    """
    Configuración para LLMs - Optimizada para respuestas cortas
    """
    
    # Habilitar/deshabilitar LLMs
    LLM_ENABLED: bool = False  # Cambiar a True cuando esté listo
    
    # Configuración de feedback
    LLM_FEEDBACK_LANGUAGE: str = "spanish"  # "spanish" o "english"
    # LLM_FEEDBACK_LANGUAGE: str = "spanish"  # "spanish" o "english" 
    LLM_FEEDBACK_LENGTH: str = "brief"  # "brief", "normal", "detailed"
    
    # Configuración de Ollama
    OLLAMA_URL: str = "https://ollama-354865198391.us-central1.run.app"
    OLLAMA_MODEL: str = "qwen2.5:1.5b-instruct-q4_0"
    # OLLAMA_MODEL: str = "qwen2.5:1.5b-instruct-q4_0"

    
    # # Configuración de evaluación
    # LLM_TEMPERATURE: float = 0.1  # Bajo para consistencia
    # LLM_MAX_TOKENS: int = 60  # Muy limitado para respuestas cortas
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 80
    LLM_TIMEOUT: int = 20  # segundos - menos tiempo
    
    # Para exámenes con múltiples preguntas
    LLM_EXAM_MODE: bool = True  # Activa respuestas ultra-cortas
    LLM_MAX_FEEDBACK_LENGTH: int = 150  # caracteres máximo en modo examen