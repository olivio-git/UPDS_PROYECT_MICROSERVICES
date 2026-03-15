"""
Authentication Middleware for AI Grading Service
"""

import jwt
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..config.settings import settings

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    """
    JWT Authentication middleware for API protection
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.secret_key = settings.JWT_SECRET
        self.algorithm = settings.JWT_ALGORITHM
        
        # Paths that don't require authentication
        self.public_paths = {
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/grading/status"
        }
    
    async def dispatch(self, request: Request, call_next):
        """
        Process the request through authentication middleware
        """
        
        # Skip authentication for public paths
        if request.url.path in self.public_paths:
            return await call_next(request)
        
        # Skip authentication in development mode if JWT_SECRET is not set
        if settings.env == "development" and not self.secret_key:
            logger.warning("🔓 Running without authentication in development mode")
            return await call_next(request)
        
        try:
            # Extract token from Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return self._create_auth_error("Token de autorización requerido")
            
            # Validate Bearer token format
            try:
                scheme, token = auth_header.split()
                if scheme.lower() != "bearer":
                    return self._create_auth_error("Formato de token inválido. Use 'Bearer <token>'")
            except ValueError:
                return self._create_auth_error("Formato de Authorization header inválido")
            
            # Decode and validate JWT token
            payload = self._decode_token(token)
            if not payload:
                return self._create_auth_error("Token inválido o expirado")
            
            # Add user information to request state
            request.state.user = payload
            request.state.authenticated = True
            
            # Log successful authentication
            user_id = payload.get("sub") or payload.get("user_id") or "unknown"
            logger.info(f"🔐 Request authenticated - User: {user_id} - Path: {request.url.path}")
            
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.error(f"❌ Authentication middleware error: {e}")
            return self._create_auth_error("Error interno de autenticación")
    
    def _decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and validate JWT token
        """
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True
                }
            )
            
            # Validate required claims
            if not payload.get("sub") and not payload.get("user_id"):
                logger.warning("Token without user identification")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token decode error: {e}")
            return None
    
    def _create_auth_error(self, message: str) -> JSONResponse:
        """
        Create standardized authentication error response
        """
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "error": {
                    "type": "AuthenticationError",
                    "status_code": 401,
                    "message": message,
                    "hint": "Incluya un token JWT válido en el header 'Authorization: Bearer <token>'"
                }
            }
        )

# Utility functions for manual authentication
def get_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    """
    Extract user information from authenticated request
    """
    return getattr(request.state, 'user', None)

def is_authenticated(request: Request) -> bool:
    """
    Check if request is authenticated
    """
    return getattr(request.state, 'authenticated', False)

def require_auth(request: Request) -> Dict[str, Any]:
    """
    Require authentication and return user info, raise exception if not authenticated
    """
    if not is_authenticated(request):
        raise HTTPException(
            status_code=401,
            detail="Autenticación requerida"
        )
    
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Información de usuario no disponible"
        )
    
    return user

def get_user_id(request: Request) -> str:
    """
    Get user ID from authenticated request
    """
    user = require_auth(request)
    return user.get("sub") or user.get("user_id") or "unknown"

def has_permission(request: Request, permission: str) -> bool:
    """
    Check if authenticated user has specific permission
    """
    if not is_authenticated(request):
        return False
    
    user = get_user_from_request(request)
    if not user:
        return False
    
    # Check permissions in token
    permissions = user.get("permissions", [])
    roles = user.get("roles", [])
    
    # Check direct permission
    if permission in permissions:
        return True
    
    # Check role-based permissions (admin has all permissions)
    if "admin" in roles:
        return True
    
    # Check specific role permissions
    role_permissions = {
        "teacher": ["evaluate", "view_results", "create_exams"],
        "student": ["take_exam", "view_own_results"],
        "evaluator": ["evaluate", "view_results"]
    }
    
    for role in roles:
        if role in role_permissions and permission in role_permissions[role]:
            return True
    
    return False

def require_permission(request: Request, permission: str):
    """
    Require specific permission, raise exception if not authorized
    """
    if not has_permission(request, permission):
        raise HTTPException(
            status_code=403,
            detail=f"Permiso requerido: {permission}"
        )
