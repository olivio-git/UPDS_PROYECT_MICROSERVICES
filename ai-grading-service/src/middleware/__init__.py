"""
AI Grading Service - Middleware Module
"""

from .auth_middleware import AuthMiddleware
from .logging_middleware import LoggingMiddleware

__all__ = [
    'AuthMiddleware',
    'LoggingMiddleware'
]
