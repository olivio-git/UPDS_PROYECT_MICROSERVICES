"""
Logging Middleware for AI Grading Service
"""

import time
import uuid
import logging
from typing import Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request/response logging and monitoring
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.sensitive_paths = {
            "/api/v1/grading/speaking/evaluate",
            "/api/v1/grading/listening/evaluate"
        }
    
    async def dispatch(self, request: Request, call_next):
        """
        Process request through logging middleware
        """
        start_time = time.time()
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        
        # Extract client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "unknown")
        
        # Extract user info if authenticated
        user_info = self._get_user_info(request)
        
        # Log request start
        logger.info(
            f"🔄 [{request_id}] {request.method} {request.url.path} "
            f"- Client: {client_ip} - User: {user_info}"
        )
        
        # Add request ID to state for use in controllers
        request.state.request_id = request_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Log response
            self._log_response(request_id, request, response, process_time)
            
            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.3f}s"
            
            return response
            
        except Exception as e:
            # Calculate processing time for error cases
            process_time = time.time() - start_time
            
            # Log error
            logger.error(
                f"❌ [{request_id}] Error processing {request.method} {request.url.path} "
                f"- Error: {type(e).__name__}: {e} - Time: {process_time:.3f}s"
            )
            
            # Re-raise exception
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address, considering proxy headers
        """
        # Check common proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"
    
    def _get_user_info(self, request: Request) -> str:
        """
        Extract user information from request state
        """
        try:
            user = getattr(request.state, 'user', None)
            if user:
                user_id = user.get("sub") or user.get("user_id") or "unknown"
                roles = user.get("roles", [])
                role_str = f"[{','.join(roles)}]" if roles else ""
                return f"{user_id}{role_str}"
            return "anonymous"
        except:
            return "anonymous"
    
    def _log_response(
        self, 
        request_id: str, 
        request: Request, 
        response: Response, 
        process_time: float
    ):
        """
        Log response information
        """
        status_code = response.status_code
        
        # Determine log level based on status code
        if status_code < 400:
            log_level = logging.INFO
            status_emoji = "✅"
        elif status_code < 500:
            log_level = logging.WARNING
            status_emoji = "⚠️"
        else:
            log_level = logging.ERROR
            status_emoji = "❌"
        
        # Get response size if available
        content_length = response.headers.get("Content-Length", "unknown")
        
        # Log response
        logger.log(
            log_level,
            f"{status_emoji} [{request_id}] {request.method} {request.url.path} "
            f"-> {status_code} - {process_time:.3f}s - {content_length} bytes"
        )
        
        # Additional logging for slow requests
        if process_time > 5.0:  # Slow request threshold
            logger.warning(
                f"🐌 [{request_id}] Slow request detected: {process_time:.3f}s "
                f"for {request.method} {request.url.path}"
            )
        
        # Log file upload information for audio/file endpoints
        if request.url.path in self.sensitive_paths and status_code < 400:
            logger.info(
                f"📁 [{request_id}] File processing completed successfully "
                f"in {process_time:.3f}s"
            )
    
    def _should_log_body(self, request: Request) -> bool:
        """
        Determine if request body should be logged (avoid sensitive data)
        """
        # Never log audio/file upload bodies
        if request.url.path in self.sensitive_paths:
            return False
        
        # Check content type
        content_type = request.headers.get("Content-Type", "")
        if any(skip_type in content_type for skip_type in [
            "multipart/form-data",
            "application/octet-stream",
            "audio/",
            "video/",
            "image/"
        ]):
            return False
        
        return True

# Utility functions
def get_request_id(request: Request) -> Optional[str]:
    """
    Get request ID from request state
    """
    return getattr(request.state, 'request_id', None)

def log_with_request_id(request: Request, message: str, level: int = logging.INFO):
    """
    Log message with request ID context
    """
    request_id = get_request_id(request)
    if request_id:
        message = f"[{request_id}] {message}"
    
    logger.log(level, message)
