"""
AI Grading Service - Main FastAPI Application
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

# Ensure logs directory exists and initialize logger immediately
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/ai-grading-service.log", mode="a"),
    ],
)
logger = logging.getLogger("ai-grading-service")

# Attempt to import settings and database connection singleton
settings = None
db_connections = None
grading_router = None
AuthMiddleware = None
LoggingMiddleware = None

try:
    from .config.settings import settings
    logger.info("✅ Settings loaded")
except Exception as e:
    logger.warning(f"Could not load settings module: {e}. Using fallback values.")
    class FallbackSettings:
        port = 3006
        host = "0.0.0.0"
        env = "development"
        cors_origins_list = ["*"]
        jwt_secret = None
        version = "0.0.0"
    settings = FallbackSettings()

try:
    from .database.connections import db_connections
    logger.info("✅ Database connections singleton imported")
except Exception as e:
    logger.warning(f"Database connections not available: {e}")
    db_connections = None

try:
    from .controllers.grading_controller import router as grading_router
    logger.info("✅ Grading controller imported (full version)")
    route_count = len(grading_router.routes) if grading_router else 0
    logger.info(f"📋 Grading controller has {route_count} routes")
    if grading_router:
        for route in grading_router.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                methods = ', '.join(route.methods)
                logger.info(f"   📍 Route: {methods} {grading_router.prefix}{route.path}")
except Exception as e:
    logger.error(f"❌ Grading controller import failed: {e}")
    import traceback
    logger.error(f"❌ Full traceback: {traceback.format_exc()}")
    grading_router = None

# Import question generation controller
question_generation_router = None
try:
    from .controllers.question_generation_controller import router as question_generation_router
    logger.info("✅ Question generation controller imported")
    route_count = len(question_generation_router.routes) if question_generation_router else 0
    logger.info(f"📋 Question generation controller has {route_count} routes")
    if question_generation_router:
        for route in question_generation_router.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                methods = ', '.join(route.methods)
                logger.info(f"   📍 Route: {methods} {question_generation_router.prefix}{route.path}")
except Exception as e:
    logger.error(f"❌ Question generation controller import failed: {e}")
    import traceback
    logger.error(f"❌ Full traceback: {traceback.format_exc()}")
    question_generation_router = None

try:
    from .middleware.auth_middleware import AuthMiddleware
    from .middleware.logging_middleware import LoggingMiddleware
    logger.info("✅ Middleware imported")
except Exception as e:
    logger.debug(f"Optional middleware missing: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan: connect to DB and Redis if available, then yield."""
    logger.info("🚀 Starting AI Grading Service...")

    redis_client = None
    try:
        if db_connections is not None:
            # attempt to connect to mongodb and redis using singleton
            try:
                await db_connections.connect_mongodb()
                await db_connections.connect_redis()
                logger.info("✅ Database connections established")
            except Exception as e:
                logger.error(f"❌ Failed to establish DB connections: {e}")
        else:
            logger.info("ℹ️  Skipping DB connection - db_connections not available")
    except Exception as e:
        logger.error(f"Unexpected error during startup DB connect: {e}")

    yield

    # shutdown: close db connections if available
    try:
        if db_connections is not None:
            try:
                await db_connections.close_connections()
                logger.info("✅ DB connections closed")
            except Exception as e:
                logger.error(f"Error closing DB connections: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during shutdown: {e}")


# Create FastAPI application
app = FastAPI(
    title="AI Grading Service",
    description="Servicio de evaluación automatizada con IA para competencias lingüísticas",
    version=getattr(settings, "version", "1.0.0"),
    lifespan=lifespan,
    docs_url="/docs" if getattr(settings, "env", "development") != "production" else None,
    redoc_url="/redoc" if getattr(settings, "env", "development") != "production" else None,
)

# Add CORS middleware
try:
    origins = getattr(settings, "cors_origins_list", None) or getattr(settings, "cors_origins", ["*"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception as e:
    logger.warning(f"Failed to configure CORS middleware: {e}")

# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add optional middleware
if LoggingMiddleware is not None:
    app.add_middleware(LoggingMiddleware)
if getattr(settings, "jwt_secret", None):
    if AuthMiddleware is not None:
        app.add_middleware(AuthMiddleware)

# Include grading router if available
if grading_router is not None:
    logger.info("📡 Including grading router with prefix '/api/v1'")
    app.include_router(grading_router, prefix="/api/v1")
    logger.info("✅ Grading router included successfully")
else:
    logger.error("❌ Grading router is None - routes will not be available!")

# Include question generation router if available
if question_generation_router is not None:
    logger.info("📡 Including question generation router with prefix '/api/v1'")
    app.include_router(question_generation_router, prefix="/api/v1")
    logger.info("✅ Question generation router included successfully")
else:
    logger.error("❌ Question generation router is None - generation routes will not be available!")

# Log final routes for debugging
logger.info("📋 Final application routes:")
for route in app.routes:
    if hasattr(route, 'methods') and hasattr(route, 'path'):
        methods = ', '.join(route.methods)
        logger.info(f"   📍 {methods} {route.path}")


# Health endpoint
@app.get("/health")
async def health():
    info = {
        "status": "healthy",
        "service": "AI Grading Service",
        "version": getattr(settings, "version", "1.0.0"),
    }
    # If possible, include DB health
    if db_connections is not None:
        try:
            db_health = await db_connections.health_check()
            info.update({"database": db_health})
        except Exception as e:
            info.update({"database": "unavailable", "database_error": str(e)})
    else:
        info.update({"database": "skipped"})

    return info


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - Path: {request.url.path}")
    return JSONResponse(status_code=exc.status_code, content={
        "success": False,
        "error": {"type": "HTTPException", "status_code": exc.status_code, "message": exc.detail}
    })

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc} - Path: {request.url.path}")
    return JSONResponse(status_code=422, content={"success": False, "errors": exc.errors()})


if __name__ == "__main__":
    uvicorn.run(app, host=getattr(settings, "host", "0.0.0.0"), port=getattr(settings, "port", 3006))
