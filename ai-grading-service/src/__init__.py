"""
AI Grading Service - Main Package
Servicio de evaluación automatizada con IA para competencias lingüísticas
"""

__version__ = "1.0.0"
__author__ = "UPDS - Sistema de Evaluación"
__description__ = "Servicio de evaluación automatizada con IA"

# Package imports for easier access
from .config.settings import settings

__all__ = [
    'settings'
]
