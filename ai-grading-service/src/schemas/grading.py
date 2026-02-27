from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from enum import Enum

class MCERLevel(str, Enum):
    """MCER Levels"""
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

class Competency(str, Enum):
    """Language Competencies"""
    READING = "reading"
    WRITING = "writing"
    LISTENING = "listening"
    SPEAKING = "speaking"

class EvaluationStatus(str, Enum):
    """Evaluation Status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# Base Models
class BaseRequest(BaseModel):
    """Base request model"""
    session_id: Optional[str] = None
    candidate_id: Optional[str] = None
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class BaseResponse(BaseModel):
    """Base response model"""
    success: bool
    message: str
    processing_time: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Text Evaluation Models
class WritingEvaluationRequest(BaseRequest):
    """Request for writing evaluation"""
    text: str = Field(..., max_length=5000)
    level: MCERLevel
    competency: Competency = Competency.WRITING
    rubric: Dict[str, Any]
    context: Optional[str] = None

class ReadingEvaluationRequest(BaseRequest):
    """Request for reading comprehension evaluation"""
    text: str = Field(..., max_length=5000)
    questions: List[Dict[str, Any]]
    answers: List[Dict[str, Any]]
    level: MCERLevel
    rubric: Dict[str, Any]

class ReadingEvaluationResponse(BaseResponse):
    """Response for reading comprehension evaluation"""
    score: float
    max_score: float
    percentage: float
    level_achieved: MCERLevel
    correct_answers: int
    total_questions: int
    question_scores: List[Dict[str, Any]]
    comprehension_level: str
    feedback: str
    recommendations: List[str]
    rubric_scores: Dict[str, float]

class GrammarError(BaseModel):
    """Grammar error detected"""
    text: str
    start: int
    end: int
    error_type: str
    suggestion: str
    confidence: float

class TextMetrics(BaseModel):
    """Text analysis metrics"""
    word_count: int
    sentence_count: int
    paragraph_count: int
    avg_sentence_length: float
    complexity_score: float
    readability_score: float
    grammar_errors: List[GrammarError]
    vocabulary_level: str
    lexical_diversity: float
    language_detected: Optional[str] = None

class WritingEvaluationResponse(BaseResponse):
    """Response for writing evaluation"""
    score: float
    max_score: float
    percentage: float
    level_achieved: MCERLevel
    metrics: TextMetrics
    feedback: str
    recommendations: List[str]
    rubric_scores: Dict[str, float]
    feedback_markdown: Optional[str] = None

# Audio Evaluation Models
class SpeakingEvaluationRequest(BaseRequest):
    """Request for speaking evaluation"""
    audio_data: bytes
    prompt_text: Optional[str] = None
    target_level: Optional[MCERLevel] = None
    expected_duration: Optional[int] = None  # seconds
    topic: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None

class AudioMetrics(BaseModel):
    """Audio analysis metrics"""
    duration: float
    avg_volume: float
    silence_percentage: float
    speaking_rate: float  # words per minute
    pause_count: int
    avg_pause_duration: float
    pitch_variation: float
    energy_variation: float

class ListeningEvaluationRequest(BaseRequest):
    """Request for listening comprehension evaluation"""
    audio_data: bytes
    user_answers: List[Dict[str, Any]]
    correct_answers: List[Dict[str, Any]]
    target_level: Optional[MCERLevel] = None
    rubric: Optional[Dict[str, Any]] = None

class ListeningEvaluationResponse(BaseResponse):
    """Response for listening comprehension evaluation"""
    score: float
    max_score: float
    percentage: float
    level_achieved: MCERLevel
    transcript: str
    audio_metrics: AudioMetrics
    correct_answers: int
    total_questions: int
    question_scores: List[Dict[str, Any]]
    comprehension_level: str
    feedback: str
    recommendations: List[str]
    rubric_scores: Dict[str, float]

class PronunciationScore(BaseModel):
    """Pronunciation scoring"""
    overall_score: float
    phoneme_accuracy: float
    stress_accuracy: float
    intonation_score: float
    fluency_score: float

class SpeakingEvaluationResponse(BaseResponse):
    """Response for speaking evaluation"""
    transcript: str
    confidence: float
    score: float
    max_score: float
    percentage: float
    level_achieved: MCERLevel
    audio_metrics: AudioMetrics
    pronunciation_score: PronunciationScore
    text_evaluation: Dict[str, Any]  # Results from text analysis of transcript
    feedback: str
    recommendations: List[str]
    rubric_scores: Dict[str, float]

# MCER Scoring Models
class CompetencyScore(BaseModel):
    """Score for a specific competency"""
    competency: Competency
    score: float
    max_score: float
    percentage: float
    level: MCERLevel
    feedback: str

class MCERScoreRequest(BaseRequest):
    """Request for MCER score calculation"""
    competency_scores: List[Dict[str, float]]
    weights: Optional[Dict[str, float]] = None
    target_level: Optional[MCERLevel] = None

class MCERScoreResponse(BaseResponse):
    """Response for MCER scoring"""
    overall_score: float
    max_score: float
    percentage: float
    level_achieved: MCERLevel
    competency_scores: List[CompetencyScore]
    level_breakdown: Dict[MCERLevel, float]  # probability for each level
    recommendation: str
    next_level_requirements: Optional[Dict[str, str]] = None

# Comprehensive Evaluation Models
class ComprehensiveEvaluationRequest(BaseRequest):
    """Request for comprehensive evaluation of all competencies"""
    evaluations: List[Dict[str, Any]]  # List of individual evaluations
    weights: Optional[Dict[str, float]] = None
    target_level: Optional[MCERLevel] = None

class ComprehensiveEvaluationResponse(BaseResponse):
    """Response for comprehensive evaluation"""
    overall_results: MCERScoreResponse
    individual_results: Dict[str, Union[WritingEvaluationResponse, SpeakingEvaluationResponse]]
    final_level: MCERLevel
    certificate_eligible: bool
    improvement_plan: List[str]

# Utility Models
class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: datetime
    database: Dict[str, bool]
    models_loaded: Dict[str, bool]
    uptime: float

class ModelStatus(BaseModel):
    """AI Model status"""
    name: str
    loaded: bool
    version: Optional[str] = None
    last_updated: Optional[datetime] = None
    memory_usage: Optional[float] = None

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: str
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
