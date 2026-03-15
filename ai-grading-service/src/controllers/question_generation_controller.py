"""
Question Generation API Controller
"""

import logging
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse

from ..services.question_generation_service import QuestionGenerationService
from ..schemas.question_generation import (
    QuestionGenerationRequest,
    QuestionGenerationResponse,
    QuestionType,
    Competency,
    MCERLevel
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/questions", tags=["question-generation"])

# Service instance
question_service: Optional[QuestionGenerationService] = None

async def get_question_service() -> QuestionGenerationService:
    """Get or create question generation service instance"""
    global question_service
    if question_service is None:
        question_service = QuestionGenerationService()
        await question_service.initialize()
    return question_service

@router.post("/generate", response_model=QuestionGenerationResponse)
async def generate_questions(
    request: QuestionGenerationRequest,
    service: QuestionGenerationService = Depends(get_question_service)
):
    """
    Generate AI-powered questions based on specified parameters

    This endpoint generates educational questions using AI, with specialized prompts
    for different competencies and question types following MCER standards.
    """
    start_time = time.time()

    try:
        logger.info(f"🔄 Generating questions: {request.competency.value} | "
                   f"{request.question_type.value} | {request.level.value}")

        # Validate request parameters
        _validate_generation_request(request)

        # Generate questions
        result = await service.generate_questions(request)

        # Log generation results
        logger.info(f"✅ Generation completed in {result.processing_time:.2f}s | "
                   f"Success: {result.success} | "
                   f"Questions: {len(result.generated_questions)} | "
                   f"Confidence: {result.confidence_score:.2f}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in question generation: {e}")
        processing_time = time.time() - start_time

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Question generation failed",
                "message": str(e),
                "processing_time": processing_time
            }
        )

@router.post("/generate/bulk")
async def generate_questions_bulk(
    requests: list[QuestionGenerationRequest],
    service: QuestionGenerationService = Depends(get_question_service)
):
    """
    Generate multiple questions in batch
    """
    if len(requests) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 questions per batch request"
        )

    try:
        logger.info(f"🔄 Bulk generation: {len(requests)} requests")

        results = []
        for i, request in enumerate(requests):
            try:
                logger.info(f"Processing request {i+1}/{len(requests)}")
                result = await service.generate_questions(request)
                results.append({
                    "index": i,
                    "success": True,
                    "result": result
                })
            except Exception as e:
                logger.error(f"❌ Error in bulk request {i+1}: {e}")
                results.append({
                    "index": i,
                    "success": False,
                    "error": str(e)
                })

        successful = sum(1 for r in results if r["success"])
        logger.info(f"✅ Bulk generation completed: {successful}/{len(requests)} successful")

        return {
            "success": True,
            "total_requests": len(requests),
            "successful_generations": successful,
            "failed_generations": len(requests) - successful,
            "results": results
        }

    except Exception as e:
        logger.error(f"❌ Error in bulk generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Bulk generation failed: {str(e)}"
        )

@router.get("/generate/preview")
async def preview_generation_prompt(
    competency: Competency,
    question_type: QuestionType,
    level: MCERLevel,
    difficulty: int = Query(ge=1, le=5, default=3),
    topic: Optional[str] = None,
    subtopic: Optional[str] = None,
    context: Optional[str] = None,
    service: QuestionGenerationService = Depends(get_question_service)
):
    """
    Preview the prompt that would be used for generation (for debugging)
    """
    try:
        # Create request object
        request = QuestionGenerationRequest(
            competency=competency,
            level=level,
            question_type=question_type,
            difficulty=difficulty,
            topic=topic,
            subtopic=subtopic,
            context=context
        )

        # Generate prompt without calling LLM
        prompt = service.prompt_engine.generate_prompt(
            competency=request.competency,
            question_type=request.question_type,
            level=request.level,
            difficulty=request.difficulty,
            topic=request.topic,
            subtopic=request.subtopic,
            context=request.context,
            target_language=getattr(request, 'target_language', 'es')
        )

        return {
            "success": True,
            "parameters": {
                "competency": competency.value,
                "question_type": question_type.value,
                "level": level.value,
                "difficulty": difficulty,
                "topic": topic,
                "subtopic": subtopic
            },
            "generated_prompt": prompt,
            "prompt_length": len(prompt),
            "estimated_tokens": len(prompt.split())
        }

    except Exception as e:
        logger.error(f"❌ Error previewing prompt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Prompt preview failed: {str(e)}"
        )

@router.get("/capabilities")
async def get_generation_capabilities():
    """
    Get available competencies, question types, and levels
    """
    return {
        "success": True,
        "capabilities": {
            "competencies": {
                comp.value: comp.value.replace("_", " ").title()
                for comp in Competency
            },
            "question_types": {
                qt.value: qt.value.replace("_", " ").title()
                for qt in QuestionType
            },
            "mcer_levels": {
                level.value: level.value
                for level in MCERLevel
            },
            "difficulty_range": {"min": 1, "max": 5},
            "max_questions_per_request": 5,
            "max_bulk_requests": 10
        },
        "recommendations": {
            "reading": ["multiple_choice", "true_false", "open_text"],
            "writing": ["essay", "writing", "open_text"],
            "listening": ["multiple_choice", "true_false", "matching"],
            "speaking": ["speaking", "open_text"],
            "grammar": ["multiple_choice", "fill_blanks", "ordering"],
            "vocabulary": ["multiple_choice", "matching", "fill_blanks"]
        }
    }

@router.get("/status")
async def get_generation_status(
    service: QuestionGenerationService = Depends(get_question_service)
):
    """
    Get question generation service status
    """
    try:
        stats = service.get_generation_statistics()

        return {
            "status": "operational" if stats["service_initialized"] else "initializing",
            "llm_available": stats["llm_available"],
            "capabilities": {
                "competencies": len(stats["supported_competencies"]),
                "question_types": len(stats["supported_question_types"]),
                "levels": len(stats["supported_levels"])
            },
            "service_info": {
                "initialized": stats["service_initialized"],
                "model_name": getattr(service.llm_service, 'model_name', 'N/A') if service.llm_service else 'N/A',
                "prompt_engine": "specialized_templates_v1.0",
                "parser": "robust_fallback_v1.0"
            }
        }

    except Exception as e:
        logger.error(f"❌ Error getting status: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e)
            }
        )

def _validate_generation_request(request: QuestionGenerationRequest) -> None:
    """Validate generation request parameters"""

    # Validate question count
    if request.question_count and (request.question_count < 1 or request.question_count > 5):
        raise HTTPException(
            status_code=400,
            detail="Question count must be between 1 and 5"
        )

    # Validate difficulty
    if request.difficulty < 1 or request.difficulty > 5:
        raise HTTPException(
            status_code=400,
            detail="Difficulty must be between 1 and 5"
        )

    # Validate estimated time if provided
    if request.estimated_time and (request.estimated_time < 1 or request.estimated_time > 180):
        raise HTTPException(
            status_code=400,
            detail="Estimated time must be between 1 and 180 minutes"
        )

    # Validate topic length
    if request.topic and len(request.topic) > 200:
        raise HTTPException(
            status_code=400,
            detail="Topic must be less than 200 characters"
        )

    # Type-specific validations
    if request.question_type == QuestionType.AUDIO_RESPONSE and not request.topic:
        logger.warning("Audio response questions work better with specific topics")

    if request.question_type == QuestionType.SPEAKING and request.estimated_time and request.estimated_time < 2:
        raise HTTPException(
            status_code=400,
            detail="Speaking questions should have at least 2 minutes"
        )

    # Level-difficulty consistency check
    level_min_difficulty = {
        MCERLevel.A1: 1,
        MCERLevel.A2: 1,
        MCERLevel.B1: 2,
        MCERLevel.B2: 3,
        MCERLevel.C1: 4,
        MCERLevel.C2: 4
    }

    min_difficulty = level_min_difficulty.get(request.level, 1)
    if request.difficulty < min_difficulty:
        logger.warning(f"Difficulty {request.difficulty} might be too low for level {request.level.value}")

@router.post("/test/parse")
async def test_response_parsing(
    raw_response: str,
    competency: Competency,
    question_type: QuestionType,
    level: MCERLevel,
    service: QuestionGenerationService = Depends(get_question_service)
):
    """
    Test endpoint for parsing AI responses (debugging)
    """
    try:
        context = {
            "competency": competency.value,
            "question_type": question_type.value,
            "level": level.value,
            "difficulty": 3,
            "topic": "test"
        }

        parsed_question, fallbacks = service.parser.parse_ai_response(raw_response, context)

        return {
            "success": True,
            "parsing_result": {
                "question": parsed_question.dict(),
                "fallbacks_applied": fallbacks,
                "fallback_count": len(fallbacks)
            },
            "original_response": raw_response[:500] + "..." if len(raw_response) > 500 else raw_response
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "original_response": raw_response[:200] + "..." if len(raw_response) > 200 else raw_response
        }