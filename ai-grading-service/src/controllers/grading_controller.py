"""
AI Grading Service - Grading Controller
"""

import logging
import time
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse  # (may be unused; retained if needed elsewhere)

from ..services.text_grading_service import TextGradingService
from ..services.audio_grading_service import AudioGradingService
from ..services.mcer_scoring_service import MCERScoringService
from ..schemas.grading import (
    WritingEvaluationRequest,
    WritingEvaluationResponse,
    ReadingEvaluationRequest,
    ReadingEvaluationResponse,
    SpeakingEvaluationRequest,
    SpeakingEvaluationResponse,
    ListeningEvaluationRequest,
    ListeningEvaluationResponse,
    MCERScoreRequest,
    MCERScoreResponse,
    ComprehensiveEvaluationRequest,
    ComprehensiveEvaluationResponse
)
from ..config.settings import settings

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/grading", tags=["grading"])

# Service instances (will be initialized with dependency injection)
text_service: Optional[TextGradingService] = None
audio_service: Optional[AudioGradingService] = None
mcer_service: Optional[MCERScoringService] = None

async def get_text_service() -> TextGradingService:
    """Get or create text grading service instance"""
    global text_service
    if text_service is None:
        text_service = TextGradingService()
        await text_service.initialize_models()
    return text_service

async def get_audio_service() -> AudioGradingService:
    """Get or create audio grading service instance"""
    global audio_service
    if audio_service is None:
        audio_service = AudioGradingService()
        await audio_service.initialize_models()
    return audio_service

async def get_mcer_service() -> MCERScoringService:
    """Get or create MCER scoring service instance"""
    global mcer_service
    if mcer_service is None:
        mcer_service = MCERScoringService()
    return mcer_service

# Simple test endpoint to verify router is working
@router.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify the router is working"""
    return {
        "success": True,
        "message": "Grading router is working correctly",
        "timestamp": time.time(),
        "available_endpoints": [
            "/grading/writing/evaluate",
            "/grading/reading/evaluate",
            "/grading/speaking/evaluate",
            "/grading/listening/evaluate"
        ]
    }

@router.post("/writing/evaluate", response_model=WritingEvaluationResponse)
async def evaluate_writing(
    request: WritingEvaluationRequest,
    text_svc: TextGradingService = Depends(get_text_service)
):
    """Evaluar competencia de escritura con análisis completo"""
    start = time.time()
    try:
        logger.info(f"📝 (FULL) Evaluando escritura - Session: {request.session_id}")
        result = await text_svc.evaluate_writing(request)
        result.processing_time = round(time.time() - start, 3)
        logger.info(
            f"✅ Escritura evaluada - Score: {result.percentage}% en {result.processing_time}s"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error evaluando escritura: {e}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando evaluación de escritura: {str(e)}"
        )

@router.post("/listening/evaluate", response_model=ListeningEvaluationResponse)
async def evaluate_listening(
    session_id: str = Form(...),
    candidate_id: str = Form(...),
    target_level: Optional[str] = Form(None),
    audio_file: UploadFile = File(...),
    user_answers: str = Form(...),  # JSON string with user answers
    correct_answers: str = Form(...),  # JSON string with correct answers
    audio_svc: AudioGradingService = Depends(get_audio_service)
):
    """
    Evaluar competencia de comprensión auditiva
    """
    try:
        logger.info(f"🎧 Evaluando comprensión auditiva - Session: {session_id}")
        
        # Validate audio file
        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=400,
                detail="El archivo debe ser de tipo audio"
            )
        
        # Read audio file
        audio_content = await audio_file.read()
        
        # Parse answers (expecting JSON strings)
        import json
        try:
            user_answers_list = json.loads(user_answers)
            correct_answers_list = json.loads(correct_answers)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Las respuestas deben estar en formato JSON válido"
            )
        
        # Create request object
        from ..schemas.grading import MCERLevel
        target_level_enum = None
        if target_level:
            try:
                target_level_enum = MCERLevel(target_level)
            except ValueError:
                logger.warning(f"Nivel objetivo inválido: {target_level}")
        
        request = ListeningEvaluationRequest(
            session_id=session_id,
            candidate_id=candidate_id,
            audio_data=audio_content,
            user_answers=user_answers_list,
            correct_answers=correct_answers_list,
            target_level=target_level_enum
        )
        
        result = await audio_svc.evaluate_listening(request)
        
        logger.info(f"✅ Comprensión auditiva evaluada - Score: {result.percentage}%")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error evaluando comprensión auditiva: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando evaluación de comprensión auditiva: {str(e)}"
        )

@router.post("/speaking/evaluate", response_model=SpeakingEvaluationResponse)
async def evaluate_speaking(
    session_id: str = Form(...),
    candidate_id: str = Form(...),
    target_level: str = Form(...),  # MCER level string
    audio_file: UploadFile = File(...),
    rubric: Optional[str] = Form(None),  # JSON string optional
    prompt_text: Optional[str] = Form(None),
    audio_svc: AudioGradingService = Depends(get_audio_service)
):
    """Evaluar competencia de speaking (pronunciación, fluidez, etc.)"""
    try:
        logger.info(f"🎤 Evaluando speaking - Session: {session_id}")

        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="El archivo debe ser de tipo audio")

        # Read audio bytes
        audio_bytes = await audio_file.read()

        # Parse rubric JSON if provided
        rubric_dict: Optional[dict] = None
        if rubric:
            import json
            try:
                rubric_dict = json.loads(rubric)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Rubric debe ser JSON válido")

        # MCER level enum
        from ..schemas.grading import MCERLevel, SpeakingEvaluationRequest
        try:
            level_enum = MCERLevel(target_level)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nivel MCER inválido")

        # Build request model (store audio bytes for reference though service uses temp file path)
        speak_req = SpeakingEvaluationRequest(
            session_id=session_id,
            candidate_id=candidate_id,
            audio_data=audio_bytes,
            prompt_text=prompt_text,
            target_level=level_enum,
            expected_duration=None,
            topic=None
        )

        # Persist to temp file to re-use existing processing pipeline
        import tempfile, os
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name
            tmp.write(audio_bytes)

        try:
            result = await audio_svc.evaluate_speaking(tmp_path, speak_req)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

        logger.info(f"✅ Speaking evaluado - Score: {result.percentage}%")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error evaluando speaking: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando evaluación de speaking: {str(e)}")

@router.post("/mcer/calculate", response_model=MCERScoreResponse)
async def calculate_mcer_scores(
    request: MCERScoreRequest,
    mcer_svc: MCERScoringService = Depends(get_mcer_service)
):
    """
    Calcular puntajes MCER basado en competencias evaluadas
    """
    try:
        logger.info(f"🎯 Calculando puntajes MCER - Session: {request.session_id}")
        
        result = await mcer_svc.calculate_mcer_scores(request)
        
        logger.info(f"✅ Puntajes MCER calculados - Nivel: {result.level_achieved.value}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error calculando puntajes MCER: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando cálculo MCER: {str(e)}"
        )

@router.post("/comprehensive/evaluate", response_model=ComprehensiveEvaluationResponse)
async def comprehensive_evaluation(
    request: ComprehensiveEvaluationRequest,
    mcer_svc: MCERScoringService = Depends(get_mcer_service)
):
    """
    Realizar evaluación comprehensiva combinando todas las competencias
    """
    try:
        logger.info(f"🎯 Evaluación comprehensiva - Session: {request.session_id}")
        
        result = await mcer_svc.comprehensive_evaluation(request)
        
        logger.info(f"✅ Evaluación comprehensiva completada - Nivel final: {result.final_level.value}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error en evaluación comprehensiva: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando evaluación comprehensiva: {str(e)}"
        )

# Utility endpoints
@router.get("/status")
async def grading_status():
    """
    Obtener estado del servicio de evaluación
    """
    try:
        # Check if services are initialized
        services_status = {
            "text_grading": text_service is not None,
            "audio_grading": audio_service is not None,
            "mcer_scoring": mcer_service is not None
        }
        
        return {
            "status": "operational",
            "services": services_status,
            "capabilities": [
                "writing_evaluation",
                "reading_evaluation", 
                "speaking_evaluation",
                "listening_evaluation",
                "mcer_scoring",
                "comprehensive_evaluation"
            ],
            "supported_formats": {
                "audio": ["wav", "mp3", "m4a", "ogg"],
                "text": ["plain_text", "json"]
            },
            "mcer_levels": ["A1", "A2", "B1", "B2", "C1", "C2"]
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estado: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e)
            }
        )

@router.get("/diagnostics")
async def grading_diagnostics(text_svc: TextGradingService = Depends(get_text_service)):
    """Diagnósticos internos: estado LLM y LanguageTool"""
    try:
        llm = getattr(text_svc, 'llm_service', None)
        lt_available = bool(getattr(text_svc, 'grammar_checker', None))
        return {
            "llm_config": {
                "enabled_flag": getattr(llm, 'enabled', False) if llm else False,
                "model": getattr(llm, 'model_name', None) if llm else None,
                "url": getattr(llm, 'ollama_url', None) if llm else None,
                "session_active": bool(getattr(llm, 'session', None)) if llm else False,
            },
            "language_tool": {
                "cached": lt_available,
                "lang": getattr(text_svc, 'grammar_checker').language if lt_available else getattr(text_svc, 'language_tool_lang', getattr(settings, 'language_tool_lang', 'es'))
            }
        }
    except Exception as e:
        logger.error(f"❌ Error en diagnostics: {e}")
        return {"error": str(e)}

@router.post("/llm/reinit")
async def reinitialize_llm(text_svc: TextGradingService = Depends(get_text_service)):
    """Forzar re-inicialización del servicio LLM y LanguageTool"""
    try:
        # Reset flags
        if getattr(text_svc, 'llm_service', None):
            text_svc.llm_service.enabled = getattr(settings, 'llm_enabled', True)
        # Force re-init by toggling internal flag
        text_svc._model_loaded = False
        await text_svc.initialize_models()
        llm = getattr(text_svc, 'llm_service', None)
        return {
            "reinitialized": True,
            "llm_enabled": bool(llm and llm.enabled),
            "llm_model": getattr(llm, 'model_name', None) if llm else None,
            "session_active": bool(getattr(llm, 'session', None)) if llm else False,
            "language_tool_cached": bool(getattr(text_svc, 'grammar_checker', None))
        }
    except Exception as e:
        logger.error(f"❌ Error reinit LLM: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/initialize")
async def initialize_services():
    """
    Inicializar servicios de evaluación (útil para warmup)
    """
    try:
        start_time = time.time()
        
        # Initialize all services
        text_svc = await get_text_service()
        audio_svc = await get_audio_service()
        mcer_svc = await get_mcer_service()
        
        initialization_time = time.time() - start_time
        
        return {
            "success": True,
            "message": "Servicios inicializados correctamente",
            "initialization_time": initialization_time,
            "services_ready": {
                "text_grading": True,
                "audio_grading": True,
                "mcer_scoring": True
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error inicializando servicios: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error inicializando servicios: {str(e)}"
        )
