"""
Ejemplo de integración del LLM local en el controller
"""

# En grading_controller.py - Modificación ejemplo

from ..services.llm_service import enhance_feedback_with_llm

@router.post("/writing/evaluate", response_model=WritingEvaluationResponse)
async def evaluate_writing(
    request: WritingEvaluationRequest,
    text_svc: TextGradingService = Depends(get_text_service)
):
    """
    Evaluar competencia de escritura CON LLM opcional
    """
    try:
        logger.info(f"📝 Evaluando escritura - Session: {request.session_id}")
        
        # 1. EVALUACIÓN TRADICIONAL (siempre funciona)
        result = await text_svc.evaluate_writing(request)
        
        # 2. ENHANCEMENT CON LLM LOCAL (si está disponible)
        try:
            enhanced_feedback = await enhance_feedback_with_llm(
                traditional_feedback=result.feedback,
                text=request.text_content,
                score=result.percentage,
                level=result.level_achieved.value,
                errors=[error.message for error in result.metrics.grammar_errors]
            )
            
            # Actualizar resultado con feedback mejorado
            result.feedback = enhanced_feedback["feedback"]
            result.recommendations = enhanced_feedback["suggestions"]
            
            logger.info(f"✨ Feedback mejorado con {enhanced_feedback['model_used']}")
            
        except Exception as llm_error:
            logger.warning(f"⚠️  LLM enhancement falló: {llm_error}")
            # El resultado tradicional se mantiene
            pass
        
        logger.info(f"✅ Escritura evaluada - Score: {result.percentage}%")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error evaluando escritura: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando evaluación de escritura: {str(e)}"
        )
