"""
Schemas for AI Question Generation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from enum import Enum

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    OPEN_TEXT = "open_text"
    ESSAY = "essay"
    FILL_BLANKS = "fill_blanks"
    DRAG_DROP = "drag_drop"
    MATCHING = "matching"
    ORDERING = "ordering"
    AUDIO_RESPONSE = "audio_response"
    FILE_UPLOAD = "file_upload"
    SPEAKING = "speaking"
    WRITING = "writing"

class Competency(str, Enum):
    READING = "reading"
    WRITING = "writing"
    LISTENING = "listening"
    SPEAKING = "speaking"
    GRAMMAR = "grammar"
    VOCABULARY = "vocabulary"

class MCERLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

# Request Schema
class QuestionGenerationRequest(BaseModel):
    competency: Competency
    level: MCERLevel
    question_type: QuestionType
    difficulty: int = Field(ge=1, le=5, description="Difficulty from 1-5")
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    estimated_time: Optional[int] = Field(None, description="Estimated time in minutes")
    context: Optional[str] = Field(None, description="Additional context or theme")
    thematic_context: Optional[str] = Field(None, description="Thematic context to inspire question content")
    target_language: Optional[str] = Field("es", description="Target language (es/en)")

    # Additional generation parameters
    question_count: Optional[int] = Field(1, ge=1, le=5, description="Number of questions to generate")
    include_multimedia: Optional[bool] = Field(False, description="Whether to include multimedia suggestions")
    rubric_focus: Optional[List[str]] = Field(None, description="Specific rubric criteria to focus on")

# Generated Question Components
class GeneratedQuestionOption(BaseModel):
    id: str
    text: str
    is_correct: bool = False
    explanation: Optional[str] = None

class GeneratedQuestionContent(BaseModel):
    question: str
    instructions: Optional[str] = None
    context: Optional[str] = None
    options: Optional[List[GeneratedQuestionOption]] = None
    correct_answer: Optional[Union[str, List[str]]] = None
    keywords: Optional[List[str]] = None

    # For specific question types
    template: Optional[str] = None  # fill_blanks
    blanks: Optional[List[Dict[str, Any]]] = None  # fill_blanks
    items: Optional[List[Dict[str, Any]]] = None  # matching, drag_drop, ordering

    # Multimedia suggestions
    media_type: Optional[str] = None
    media_description: Optional[str] = None
    media_script: Optional[str] = None  # For audio questions

class GeneratedQuestionMetadata(BaseModel):
    topic: Optional[str] = "general"
    subtopic: Optional[str] = None
    tags: List[str] = []
    estimated_time: Optional[int] = None
    points: int = 1

    # AI generation info
    generated_by: str = "ai"
    generation_model: Optional[str] = None
    generation_confidence: Optional[float] = None
    alternative_versions: Optional[int] = None

# Response Schema
class GeneratedQuestion(BaseModel):
    type: QuestionType
    competency: Competency
    level: MCERLevel
    difficulty: int
    content: GeneratedQuestionContent
    metadata: GeneratedQuestionMetadata
    points: int = 1
    is_active: bool = True

    # Generation metadata
    ai_generated: bool = True
    generation_prompt_version: Optional[str] = None
    fallback_used: Optional[bool] = False

class QuestionGenerationResponse(BaseModel):
    success: bool
    message: str
    processing_time: float

    # Generated content
    generated_questions: List[GeneratedQuestion]
    model_used: str
    prompt_tokens: Optional[int] = None

    # Quality indicators
    confidence_score: Optional[float] = None
    validation_passed: bool = True
    fallback_applied: Optional[List[str]] = None

    # Suggestions for improvement
    suggestions: Optional[List[str]] = None