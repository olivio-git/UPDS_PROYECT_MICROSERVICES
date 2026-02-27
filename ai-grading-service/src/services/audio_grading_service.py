try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    whisper = None

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    librosa = None

import numpy as np
import asyncio
import time
import logging
import tempfile
import os
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

from ..schemas.grading import (
    SpeakingEvaluationRequest,
    SpeakingEvaluationResponse, 
    ListeningEvaluationRequest,
    ListeningEvaluationResponse,
    AudioMetrics,
    PronunciationScore,
    MCERLevel
)
from ..config.settings import settings
from .text_grading_service import TextGradingService

logger = logging.getLogger(__name__)

class AudioGradingService:
    """
    Service for evaluating audio responses (Speaking)
    Integrates audio analysis with text evaluation of transcripts
    """
    
    def __init__(self):
        self.whisper_model = None
        self.text_service = TextGradingService()
        self._model_loaded = False
        self._loading_lock = asyncio.Lock()
    
    async def initialize_models(self):
        """Initialize Whisper model and text service"""
        async with self._loading_lock:
            if self._model_loaded:
                return
                
            try:
                logger.info("🎤 Iniciando carga de modelos de audio...")
                
                if not WHISPER_AVAILABLE:
                    logger.warning("⚠️ Whisper no disponible - servicios de audio deshabilitados")
                    self._model_loaded = True
                    return
                    
                if not LIBROSA_AVAILABLE:
                    logger.warning("⚠️ Librosa no disponible - análisis de audio limitado")
                
                # Load Whisper model
                logger.info(f"📦 Cargando modelo Whisper: {settings.whisper_model}")
                self.whisper_model = whisper.load_model(settings.whisper_model)
                
                # Initialize text grading service
                await self.text_service.initialize_models()
                
                self._model_loaded = True
                logger.info("✅ Modelos de audio cargados exitosamente")
                
            except Exception as e:
                logger.error(f"❌ Error cargando modelos de audio: {e}")
                raise
    
    async def evaluate_speaking(
        self, 
        audio_file_path: str,
        request: SpeakingEvaluationRequest
    ) -> SpeakingEvaluationResponse:
        """
        Comprehensive speaking evaluation
        """
        start_time = time.time()
        
        try:
            # Ensure models are loaded
            await self.initialize_models()
            
            # Check if audio processing is available
            if not WHISPER_AVAILABLE:
                return self._create_error_response(
                    "Servicio de audio no disponible: Whisper no instalado",
                    processing_time=time.time() - start_time
                )
            
            # SpeakingEvaluationRequest no define 'level'; usar target_level
            level_enum = request.target_level or MCERLevel.A1
            logger.info(f"🎤 Evaluando audio para nivel {level_enum}")
            
            # Step 1: Audio quality validation
            audio_validation = await self._validate_audio_file(audio_file_path)
            if not audio_validation["valid"]:
                return self._create_error_response(
                    f"Audio inválido: {audio_validation['error']}",
                    time.time() - start_time
                )
            
            # Step 2: Transcription
            transcription_result = await self._transcribe_audio(audio_file_path)
            transcript = transcription_result["text"]
            confidence = transcription_result["confidence"]
            
            if not transcript or len(transcript.strip()) < 10:
                return self._create_error_response(
                    "Audio muy corto o inaudible",
                    time.time() - start_time
                )
            
            # Step 3: Audio metrics analysis
            audio_metrics = await self._analyze_audio_metrics(audio_file_path)
            
            # Step 4: Pronunciation analysis
            pronunciation_score = await self._analyze_pronunciation(
                audio_file_path,
                transcript,
                level_enum
            )
            
            # Step 5: Text evaluation of transcript
            from ..schemas.grading import WritingEvaluationRequest
            text_request = WritingEvaluationRequest(
                text=transcript,
                level=level_enum,
                competency="speaking",  # Will be converted to appropriate enum
                rubric=request.rubric or {},
                session_id=request.session_id,
                candidate_id=request.candidate_id
            )
            
            text_evaluation = await self.text_service.evaluate_writing(text_request)
            
            # Step 6: Calculate overall speaking score
            overall_scores = await self._calculate_speaking_scores(
                audio_metrics,
                pronunciation_score,
                text_evaluation,
                level_enum,
                request.rubric or {}
            )
            
            # Step 7: Generate feedback
            feedback = await self._generate_speaking_feedback(
                audio_metrics,
                pronunciation_score,
                text_evaluation,
                overall_scores,
                level_enum
            )
            
            processing_time = time.time() - start_time
            
            return SpeakingEvaluationResponse(
                success=True,
                message="Evaluación de speaking completada",
                processing_time=processing_time,
                transcript=transcript,
                confidence=confidence,
                score=overall_scores["total_score"],
                max_score=overall_scores["max_score"], 
                percentage=overall_scores["percentage"],
                level_achieved=overall_scores["level_achieved"],
                audio_metrics=audio_metrics,
                pronunciation_score=pronunciation_score,
                text_evaluation=text_evaluation.dict(),
                feedback=feedback["main_feedback"],
                recommendations=feedback["recommendations"],
                rubric_scores=overall_scores["rubric_breakdown"]
            )
            
        except Exception as e:
            logger.error(f"❌ Error en evaluación de speaking: {e}")
            return self._create_error_response(
                f"Error procesando audio: {str(e)}",
                time.time() - start_time
            )
    
    async def validate_audio_setup(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Validate audio setup and quality for exams
        """
        try:
            await self.initialize_models()
            
            validation_results = {
                "valid": False,
                "quality_score": 0,
                "issues": [],
                "recommendations": []
            }
            
            # Basic file validation
            file_validation = await self._validate_audio_file(audio_file_path)
            if not file_validation["valid"]:
                validation_results["issues"].append(file_validation["error"])
                return validation_results
            
            # Audio quality analysis
            quality_metrics = await self._analyze_audio_quality(audio_file_path)
            
            # Check volume levels
            if quality_metrics["avg_volume"] < 0.1:
                validation_results["issues"].append("Volumen muy bajo")
                validation_results["recommendations"].append("Acércate más al micrófono")
            elif quality_metrics["avg_volume"] > 0.9:
                validation_results["issues"].append("Volumen muy alto")
                validation_results["recommendations"].append("Aleja el micrófono o reduce el volumen")
            
            # Check background noise
            if quality_metrics["noise_level"] > 0.3:
                validation_results["issues"].append("Mucho ruido de fondo")
                validation_results["recommendations"].append("Encuentra un lugar más silencioso")
            
            # Check clarity (simple test transcription)
            test_transcription = await self._transcribe_audio(audio_file_path)
            if test_transcription["confidence"] < 0.5:
                validation_results["issues"].append("Audio poco claro")
                validation_results["recommendations"].append("Habla más claramente y verifica la calidad del micrófono")
            
            # Overall quality score
            quality_score = (
                min(quality_metrics["avg_volume"] * 100, 100) * 0.3 +
                max(0, (1 - quality_metrics["noise_level"]) * 100) * 0.3 +
                test_transcription["confidence"] * 100 * 0.4
            )
            
            validation_results["quality_score"] = quality_score
            validation_results["valid"] = quality_score >= 60 and len(validation_results["issues"]) == 0
            
            if validation_results["valid"]:
                validation_results["message"] = "Configuración de audio correcta"
            else:
                validation_results["message"] = "La configuración de audio necesita ajustes"
            
            return validation_results
            
        except Exception as e:
            logger.error(f"❌ Error validando configuración de audio: {e}")
            return {
                "valid": False,
                "error": str(e),
                "quality_score": 0
            }
    
    async def _validate_audio_file(self, file_path: str) -> Dict[str, Any]:
        """Validate audio file format and basic properties"""
        try:
            if not os.path.exists(file_path):
                return {"valid": False, "error": "Archivo no encontrado"}
            
            # Check file size
            file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
            if file_size > settings.max_audio_size_mb:
                return {"valid": False, "error": f"Archivo muy grande ({file_size:.1f}MB > {settings.max_audio_size_mb}MB)"}
            
            # Check if librosa is available
            if not LIBROSA_AVAILABLE:
                logger.warning("Librosa no disponible - validación de audio básica")
                return {"valid": True, "duration": None}  # Allow but without detailed validation
            
            # Try to load with librosa
            y, sr = librosa.load(file_path, sr=None)
            duration = len(y) / sr
            
            if duration < 5:  # Minimum 5 seconds
                return {"valid": False, "error": "Audio muy corto (mínimo 5 segundos)"}
            
            if duration > 600:  # Maximum 10 minutes
                return {"valid": False, "error": "Audio muy largo (máximo 10 minutos)"}
            
            return {
                "valid": True,
                "duration": duration,
                "sample_rate": sr,
                "file_size_mb": file_size
            }
            
        except Exception as e:
            return {"valid": False, "error": f"Error leyendo archivo de audio: {str(e)}"}
    
    async def _transcribe_audio(self, file_path: str) -> Dict[str, Any]:
        """Transcribe audio using Whisper"""
        try:
            # Run Whisper transcription in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self.whisper_model.transcribe, 
                file_path
            )
            
            # Calculate average confidence from segments
            segments = result.get("segments", [])
            if segments:
                avg_confidence = np.mean([seg.get("no_speech_prob", 0.5) for seg in segments])
                # Convert no_speech_prob to confidence (inverse relationship)
                confidence = 1 - avg_confidence
            else:
                confidence = 0.5
            
            return {
                "text": result["text"].strip(),
                "confidence": min(max(confidence, 0), 1),  # Clamp between 0 and 1
                "language": result.get("language", "unknown"),
                "segments": segments
            }
            
        except Exception as e:
            logger.error(f"Error en transcripción: {e}")
            return {
                "text": "",
                "confidence": 0,
                "error": str(e)
            }
    
    async def _analyze_audio_metrics(self, file_path: str) -> AudioMetrics:
        """Analyze audio characteristics"""
        try:
            y, sr = librosa.load(file_path, sr=None)
            duration = len(y) / sr
            
            # Volume analysis
            rms = librosa.feature.rms(y=y)[0]
            avg_volume = np.mean(rms)
            
            # Silence detection
            silence_threshold = 0.01
            silence_frames = np.sum(rms < silence_threshold)
            silence_percentage = (silence_frames / len(rms)) * 100
            
            # Speaking rate estimation (rough)
            # This is a simplified estimation - in production you'd use more sophisticated methods
            non_silence_duration = duration * (1 - silence_percentage / 100)
            # Obtain transcription once to avoid awaiting incorrectly on indexing
            transcription_data = await self._transcribe_audio(file_path)
            estimated_words = len(transcription_data.get("text", "").split())
            speaking_rate = (estimated_words / non_silence_duration * 60) if non_silence_duration > 0 else 0
            
            # Pause analysis
            pause_threshold = 0.5  # seconds
            pauses = self._detect_pauses(y, sr, pause_threshold)
            
            # Pitch and energy variation
            pitch = librosa.yin(y, fmin=50, fmax=400)
            pitch_variation = np.std(pitch[~np.isnan(pitch)])
            
            energy = librosa.feature.rms(y=y)[0]
            energy_variation = np.std(energy)
            
            return AudioMetrics(
                duration=duration,
                avg_volume=float(avg_volume),
                silence_percentage=float(silence_percentage),
                speaking_rate=float(speaking_rate),
                pause_count=len(pauses),
                avg_pause_duration=float(np.mean([p[1] - p[0] for p in pauses]) if pauses else 0),
                pitch_variation=float(pitch_variation) if not np.isnan(pitch_variation) else 0,
                energy_variation=float(energy_variation)
            )
            
        except Exception as e:
            logger.error(f"Error analizando métricas de audio: {e}")
            return AudioMetrics(
                duration=0, avg_volume=0, silence_percentage=100,
                speaking_rate=0, pause_count=0, avg_pause_duration=0,
                pitch_variation=0, energy_variation=0
            )
    
    def _detect_pauses(self, y, sr, min_duration=0.5):
        """Detect pauses in audio"""
        # Simple silence detection
        rms = librosa.feature.rms(y=y, hop_length=512)[0]
        silence_threshold = np.mean(rms) * 0.1
        
        # Find silent segments
        silent_frames = rms < silence_threshold
        frame_duration = 512 / sr
        
        pauses = []
        in_pause = False
        pause_start = 0
        
        for i, is_silent in enumerate(silent_frames):
            if is_silent and not in_pause:
                in_pause = True
                pause_start = i * frame_duration
            elif not is_silent and in_pause:
                in_pause = False
                pause_end = i * frame_duration
                if pause_end - pause_start >= min_duration:
                    pauses.append((pause_start, pause_end))
        
        return pauses
    
    async def _analyze_pronunciation(
        self, 
        file_path: str, 
        transcript: str,
        level: MCERLevel
    ) -> PronunciationScore:
        """
        Analyze pronunciation quality
        This is a simplified implementation - production would use specialized models
        """
        try:
            # Load audio
            y, sr = librosa.load(file_path, sr=16000)  # Whisper uses 16kHz
            
            # Basic pronunciation analysis using audio features
            # In production, you'd use models like wav2vec2 or specialized pronunciation models
            
            # Phoneme accuracy (simplified estimation)
            # Based on clarity of transcription and audio quality
            transcription_result = await self._transcribe_audio(file_path)
            phoneme_accuracy = transcription_result["confidence"] * 100
            
            # Stress accuracy (simplified - based on pitch variation)
            pitch = librosa.yin(y, fmin=50, fmax=400)
            valid_pitch = pitch[~np.isnan(pitch)]
            stress_accuracy = min(np.std(valid_pitch) * 10, 100) if len(valid_pitch) > 0 else 50
            
            # Intonation (pitch contour analysis)
            if len(valid_pitch) > 0:
                pitch_range = np.ptp(valid_pitch)  # Peak-to-peak
                intonation_score = min(pitch_range * 5, 100)
            else:
                intonation_score = 50
            
            # Fluency (based on pause analysis and speaking rate)
            audio_metrics = await self._analyze_audio_metrics(file_path)
            
            # Ideal speaking rate for language learning: 120-180 WPM
            rate_score = 100
            if audio_metrics.speaking_rate < 80:
                rate_score = audio_metrics.speaking_rate / 80 * 100
            elif audio_metrics.speaking_rate > 200:
                rate_score = max(0, 100 - (audio_metrics.speaking_rate - 200) * 0.5)
            
            # Pause penalty
            if audio_metrics.pause_count > 10:
                rate_score *= 0.8
            
            fluency_score = (rate_score * 0.7 + (100 - min(audio_metrics.silence_percentage, 50)) * 0.3)
            
            # Overall score (weighted average)
            overall_score = (
                phoneme_accuracy * 0.3 +
                stress_accuracy * 0.2 +
                intonation_score * 0.2 +
                fluency_score * 0.3
            )
            
            return PronunciationScore(
                overall_score=float(min(overall_score, 100)),
                phoneme_accuracy=float(min(phoneme_accuracy, 100)),
                stress_accuracy=float(min(stress_accuracy, 100)),
                intonation_score=float(min(intonation_score, 100)),
                fluency_score=float(min(fluency_score, 100))
            )
            
        except Exception as e:
            logger.error(f"Error en análisis de pronunciación: {e}")
            return PronunciationScore(
                overall_score=50.0,
                phoneme_accuracy=50.0,
                stress_accuracy=50.0,
                intonation_score=50.0,
                fluency_score=50.0
            )
    
    async def _analyze_audio_quality(self, file_path: str) -> Dict[str, float]:
        """Analyze audio quality metrics"""
        try:
            y, sr = librosa.load(file_path, sr=None)
            
            # Volume analysis
            rms = librosa.feature.rms(y=y)[0]
            avg_volume = np.mean(rms)
            
            # Noise estimation (simplified)
            # Use spectral analysis to estimate noise
            stft = librosa.stft(y)
            magnitude = np.abs(stft)
            noise_floor = np.percentile(magnitude, 10)  # Bottom 10% as noise estimate
            signal_level = np.percentile(magnitude, 90)  # Top 10% as signal estimate
            
            noise_level = noise_floor / signal_level if signal_level > 0 else 1
            
            return {
                "avg_volume": float(avg_volume),
                "noise_level": float(min(noise_level, 1))
            }
            
        except Exception as e:
            logger.error(f"Error analizando calidad de audio: {e}")
            return {"avg_volume": 0, "noise_level": 1}
    
    async def _calculate_speaking_scores(
        self,
        audio_metrics: AudioMetrics,
        pronunciation_score: PronunciationScore,
        text_evaluation: Any,
        level: MCERLevel,
        rubric: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate comprehensive speaking scores"""
        
        scores = {}
        
        # Pronunciation and Fluency (40%)
        scores["pronunciation"] = pronunciation_score.overall_score * 0.4
        
        # Content and Language Use (40%) - from text evaluation
        scores["content"] = text_evaluation.percentage * 0.4
        
        # Audio Quality and Delivery (20%)
        delivery_score = self._calculate_delivery_score(audio_metrics, level)
        scores["delivery"] = delivery_score * 0.2
        
        total_score = sum(scores.values())
        max_score = 100
        percentage = total_score
        
        # Determine achieved level
        level_achieved = await self._determine_speaking_level(
            pronunciation_score,
            text_evaluation.percentage,
            delivery_score
        )
        
        return {
            "rubric_breakdown": scores,
            "total_score": total_score,
            "max_score": max_score,
            "percentage": percentage,
            "level_achieved": level_achieved
        }
    
    def _calculate_delivery_score(self, audio_metrics: AudioMetrics, level: MCERLevel) -> float:
        """Calculate delivery and presentation score"""
        score = 50  # Base score
        
        # Speaking rate assessment
        ideal_rate = {"A1": 80, "A2": 100, "B1": 120, "B2": 140, "C1": 160, "C2": 180}
        target_rate = ideal_rate.get(level.value, 120)
        
        rate_diff = abs(audio_metrics.speaking_rate - target_rate)
        if rate_diff <= 20:
            score += 25
        elif rate_diff <= 40:
            score += 15
        elif rate_diff <= 60:
            score += 5
        
        # Pause analysis
        if 2 <= audio_metrics.pause_count <= 8:
            score += 15
        elif audio_metrics.pause_count <= 12:
            score += 10
        
        # Volume consistency
        if 0.3 <= audio_metrics.avg_volume <= 0.8:
            score += 10
        
        return min(score, 100)
    
    async def _determine_speaking_level(
        self,
        pronunciation_score: PronunciationScore,
        content_score: float,
        delivery_score: float
    ) -> MCERLevel:
        """Determine MCER level for speaking"""
        
        overall_score = (
            pronunciation_score.overall_score * 0.4 +
            content_score * 0.4 +
            delivery_score * 0.2
        )
        
        if overall_score >= 85:
            return MCERLevel.C2
        elif overall_score >= 75:
            return MCERLevel.C1
        elif overall_score >= 65:
            return MCERLevel.B2
        elif overall_score >= 55:
            return MCERLevel.B1
        elif overall_score >= 40:
            return MCERLevel.A2
        else:
            return MCERLevel.A1
    
    async def _generate_speaking_feedback(
        self,
        audio_metrics: AudioMetrics,
        pronunciation_score: PronunciationScore,
        text_evaluation: Any,
        overall_scores: Dict[str, Any],
        level: MCERLevel
    ) -> Dict[str, Any]:
        """Generate comprehensive speaking feedback"""
        
        feedback_parts = []
        recommendations = []
        
        percentage = overall_scores["percentage"]
        
        # Overall performance
        if percentage >= 80:
            feedback_parts.append("Excelente desempeño en speaking. Dominas bien la expresión oral en este nivel.")
        elif percentage >= 60:
            feedback_parts.append("Buen desempeño en speaking. Muestras competencia en la expresión oral.")
        else:
            feedback_parts.append("Tu expresión oral necesita práctica para alcanzar el nivel esperado.")
        
        # Pronunciation feedback
        if pronunciation_score.overall_score < 60:
            feedback_parts.append("La pronunciación necesita mejoras.")
            recommendations.extend([
                "Practica los sonidos más difíciles de tu idioma nativo",
                "Escucha y repite grabaciones de hablantes nativos",
                "Graba tu voz y compárala con modelos nativos"
            ])
        elif pronunciation_score.overall_score >= 80:
            feedback_parts.append("Tu pronunciación es muy clara y comprensible.")
        
        # Fluency feedback
        if pronunciation_score.fluency_score < 60:
            feedback_parts.append("Trabaja en la fluidez de tu discurso.")
            recommendations.extend([
                "Practica hablar sin pausas excesivas",
                "Lee en voz alta para mejorar la fluidez",
                "Practica conversaciones espontáneas"
            ])
        
        # Speaking rate feedback
        if audio_metrics.speaking_rate < 80:
            recommendations.append("Intenta hablar un poco más rápido para sonar más natural")
        elif audio_metrics.speaking_rate > 200:
            recommendations.append("Habla un poco más lento para mejorar la claridad")
        
        # Content feedback from text evaluation
        if hasattr(text_evaluation, 'feedback'):
            feedback_parts.append(f"Contenido: {text_evaluation.feedback}")
        
        # Audio quality feedback
        if audio_metrics.avg_volume < 0.2:
            recommendations.append("Habla con más volumen o acércate al micrófono")
        elif audio_metrics.avg_volume > 0.9:
            recommendations.append("Reduce el volumen o aléjate del micrófono")
        
        return {
            "main_feedback": " ".join(feedback_parts),
            "recommendations": list(set(recommendations))  # Remove duplicates
        }
    
    def _create_error_response(self, error_message: str, processing_time: float) -> SpeakingEvaluationResponse:
        """Create error response for speaking evaluation"""
        return SpeakingEvaluationResponse(
            success=False,
            message=error_message,
            processing_time=processing_time,
            transcript="",
            confidence=0.0,
            score=0.0,
            max_score=100.0,
            percentage=0.0,
            level_achieved=MCERLevel.A1,
            audio_metrics=AudioMetrics(
                duration=0, avg_volume=0, silence_percentage=100,
                speaking_rate=0, pause_count=0, avg_pause_duration=0,
                pitch_variation=0, energy_variation=0
            ),
            pronunciation_score=PronunciationScore(
                overall_score=0, phoneme_accuracy=0, stress_accuracy=0,
                intonation_score=0, fluency_score=0
            ),
            text_evaluation={},
            feedback=error_message,
            recommendations=[],
            rubric_scores={}
        )
    
    def is_model_loaded(self) -> bool:
        """Check if models are loaded"""
        return self._model_loaded

    async def evaluate_listening(
        self,
        request: ListeningEvaluationRequest
    ) -> ListeningEvaluationResponse:
        """Evaluate listening comprehension using provided audio and answers."""
        start_time = time.time()
        try:
            await self.initialize_models()

            # Persist audio bytes to temp file for existing processing utilities
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp_path = tmp.name
                tmp.write(request.audio_data)

            transcript = ""
            if WHISPER_AVAILABLE and self.whisper_model:
                try:
                    tr = await self._transcribe_audio(tmp_path)
                    transcript = tr.get("text", "").strip()
                except Exception as e:
                    logger.warning(f"Fallo transcripción listening: {e}")
            else:
                logger.warning("Whisper no disponible - transcript vacío")

            # Audio metrics (best effort)
            try:
                audio_metrics = await self._analyze_audio_metrics(tmp_path)
            except Exception:
                audio_metrics = AudioMetrics(
                    duration=0, avg_volume=0, silence_percentage=100,
                    speaking_rate=0, pause_count=0, avg_pause_duration=0,
                    pitch_variation=0, energy_variation=0
                )

            # Compare answers
            question_scores: List[Dict[str, Any]] = []
            correct_map = {c.get("question_id"): c for c in (request.correct_answers or [])}
            user_map = {u.get("question_id"): u for u in (request.user_answers or [])}
            total_questions = len(correct_map)
            correct_count = 0
            for qid, c in correct_map.items():
                user_ans = user_map.get(qid, {})
                expected = c.get("correct")
                given = user_ans.get("answer")
                is_correct = (str(expected).strip().lower() == str(given).strip().lower()) if given is not None else False
                if is_correct:
                    correct_count += 1
                question_scores.append({
                    "question_id": qid,
                    "expected": expected,
                    "given": given,
                    "correct": is_correct,
                    "score": 1 if is_correct else 0,
                    "max_score": 1
                })

            max_score = total_questions
            score = correct_count
            percentage = (score / max_score * 100) if max_score > 0 else 0.0

            # Determine level (reuse thresholds similar to writing)
            if percentage >= 85:
                level_achieved = MCERLevel.C2
            elif percentage >= 75:
                level_achieved = MCERLevel.C1
            elif percentage >= 65:
                level_achieved = MCERLevel.B2
            elif percentage >= 55:
                level_achieved = MCERLevel.B1
            elif percentage >= 40:
                level_achieved = MCERLevel.A2
            else:
                level_achieved = MCERLevel.A1

            # Feedback
            if percentage >= 80:
                feedback_main = f"Excelente comprensión auditiva ({correct_count}/{total_questions} correctas)."
                recommendations: List[str] = ["Continúa practicando con audios más desafiantes."]
            elif percentage >= 60:
                feedback_main = f"Buena comprensión auditiva ({correct_count}/{total_questions})."
                recommendations = ["Escucha podcasts del nivel objetivo para reforzar."]
            else:
                feedback_main = f"Necesitas mejorar la comprensión auditiva ({correct_count}/{total_questions})."
                recommendations = [
                    "Escucha audio corto diariamente y toma notas.",
                    "Repite segmentos difíciles varias veces."
                ]

            rubric_scores = {"listening_comprehension": percentage}

            processing_time = time.time() - start_time
            # Clean temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

            return ListeningEvaluationResponse(
                success=True,
                message="Evaluación de listening completada",
                processing_time=processing_time,
                score=score,
                max_score=float(max_score),
                percentage=percentage,
                level_achieved=level_achieved,
                transcript=transcript,
                audio_metrics=audio_metrics,
                correct_answers=correct_count,
                total_questions=total_questions,
                question_scores=question_scores,
                comprehension_level=level_achieved.value,
                feedback=feedback_main,
                recommendations=recommendations,
                rubric_scores=rubric_scores
            )

        except Exception as e:
            logger.error(f"Error en evaluación de listening: {e}")
            processing_time = time.time() - start_time
            return ListeningEvaluationResponse(
                success=False,
                message=f"Error evaluando listening: {str(e)}",
                processing_time=processing_time,
                score=0.0,
                max_score=100.0,
                percentage=0.0,
                level_achieved=MCERLevel.A1,
                transcript="",
                audio_metrics=AudioMetrics(
                    duration=0, avg_volume=0, silence_percentage=100,
                    speaking_rate=0, pause_count=0, avg_pause_duration=0,
                    pitch_variation=0, energy_variation=0
                ),
                correct_answers=0,
                total_questions=0,
                question_scores=[],
                comprehension_level=MCERLevel.A1.value,
                feedback="Error procesando audio",
                recommendations=[],
                rubric_scores={}
            )
