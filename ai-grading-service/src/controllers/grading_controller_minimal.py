"""
AI Grading Service - Minimal Grading Controller for debugging
"""

import logging
import time
from fastapi import APIRouter

logger = logging.getLogger(__name__)

# Create router with minimal configuration
router = APIRouter(prefix="/grading", tags=["grading"])

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify the router is working"""
    logger.info("🧪 Test endpoint called")
    return {
        "success": True,
        "message": "Minimal grading router is working correctly",
        "timestamp": time.time()
    }

@router.post("/writing/evaluate")
async def evaluate_writing_minimal():
    """Minimal writing evaluation endpoint for debugging"""
    logger.info("📝 Minimal writing evaluation called")
    return {
        "success": True,
        "message": "Minimal writing evaluation working",
        "score": 75.0,
        "timestamp": time.time()
    }

logger.info("✅ Minimal grading controller initialized")
