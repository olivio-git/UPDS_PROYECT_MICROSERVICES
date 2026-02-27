from typing import List, Optional
import os

class Settings:
    # App Configuration
    app_name: str = "AI Grading Service"
    port: int = 3006
    host: str = "0.0.0.0"
    env: str = "development"
    version: str = "1.0.0"
    
    # Database Configuration
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "upds_evaluation"
    redis_url: str = "redis://localhost:6379"
    redis_prefix: str = "ai_grading:"
    
    # Services URLs (Retrocompatibilidad con servicios Node.js)
    auth_service_url: str = "http://auth-service:3000"
    exam_service_url: str = "http://exam-service:3003"
    session_manager_url: str = "http://session-manager:3004"
    user_management_url: str = "http://user-management-service:3002"
    
    # AI Models Configuration
    whisper_model: str = "base"  # tiny, base, small, medium, large
    spacy_model: str = "en_core_web_sm"
    max_audio_size_mb: int = 10
    max_text_length: int = 5000
    
    # Kafka Configuration
    kafka_bootstrap_servers: str = "kafka:29092"
    kafka_client_id: str = "ai-grading-service"
    kafka_group_id: str = "ai-grading-group"
    
    # Security
    jwt_secret: str = "your-jwt-secret-key"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"  # String, not List
    
    # Local LLM Configuration (Ollama) - Lee desde variables de entorno
    llm_enabled: bool = True
    ollama_url: str = "https://ollama-354865198391.us-central1.run.app"
    ollama_model: str = "qwen2.5:3b-instruct"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 500
    llm_timeout: int = 120

    # Question Generation Configuration
    max_questions_per_request: int = 5
    max_bulk_requests: int = 10
    default_difficulty: int = 3
    default_points: int = 1
    question_max_length: int = 1000
    enable_question_generation: bool = True
    
    # Logging
    log_level: str = "INFO"
    
    # MCER Levels Configuration
    mcer_levels: List[str] = ["A1", "A2", "B1", "B2", "C1", "C2"]
    competencies: List[str] = ["reading", "writing", "listening", "speaking"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

    # Configuración manual de mapeo para Pydantic v2
    def __init__(self, **kwargs):
        # Mapear variables de entorno manualmente
        env_mapping = {
            'mongodb_url': os.getenv('MONGODB_URL', 'mongodb://localhost:27017'),
            'mongodb_db_name': os.getenv('MONGODB_DB_NAME', 'upds_evaluation'),
            'redis_url': os.getenv('REDIS_URL', 'redis://localhost:6379'),
            'jwt_secret': os.getenv('JWT_SECRET', 'your-jwt-secret-key'),
            'cors_origins': os.getenv('CORS_ORIGIN', 'http://localhost:5173,http://localhost:3000'),
            'llm_enabled': os.getenv('LLM_ENABLED', 'true').lower() == 'true',
            'ollama_url': os.getenv('OLLAMA_URL', 'http://localhost:11434'),
            'ollama_model': os.getenv('OLLAMA_MODEL', 'qwen2.5:1.5b-instruct-q4_0'),
            'llm_temperature': float(os.getenv('LLM_TEMPERATURE', '0.3')),
            'llm_max_tokens': int(os.getenv('LLM_MAX_TOKENS', '500')),
            'llm_timeout': int(os.getenv('LLM_TIMEOUT', '120')),
            'llm_feedback_format': os.getenv('LLM_FEEDBACK_FORMAT', 'markdown').lower(),
            'env': os.getenv('ENV', 'development'),
            # Idioma para LanguageTool (por defecto inglés)
            'language_tool_lang': os.getenv('LANGUAGE_TOOL_LANG', 'en'),
            # Question generation settings
            'max_questions_per_request': int(os.getenv('MAX_QUESTIONS_PER_REQUEST', '5')),
            'max_bulk_requests': int(os.getenv('MAX_BULK_REQUESTS', '10')),
            'default_difficulty': int(os.getenv('DEFAULT_DIFFICULTY', '3')),
            'default_points': int(os.getenv('DEFAULT_POINTS', '1')),
            'question_max_length': int(os.getenv('QUESTION_MAX_LENGTH', '1000')),
            'enable_question_generation': os.getenv('ENABLE_QUESTION_GENERATION', 'true').lower() == 'true',
        }
        
        # Aplicar valores de entorno
        for key, value in env_mapping.items():
            setattr(self, key, value)

    # Property para convertir CORS string en lista
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS origins string to list"""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",")]
        return self.cors_origins if self.cors_origins else []

# Global settings instance
settings = Settings()



# Helper functions
def get_model_path(model_name: str) -> str:
    """Get the full path for a model"""
    base_path = os.path.join(os.path.dirname(__file__), "..", "..", "models")
    return os.path.join(base_path, model_name)

def is_development() -> bool:
    """Check if running in development mode"""
    return settings.env == "development"

def get_database_url() -> str:
    """Get complete database URL"""
    return f"{settings.mongodb_url}/{settings.mongodb_db_name}"
