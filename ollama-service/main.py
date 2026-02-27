"""
Ollama Microservice - Servicio independiente para LLM
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import aiohttp
import asyncio
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Ollama LLM Service", version="1.0.0")

class LLMRequest(BaseModel):
    prompt: str
    model: str = "llama3.2:3b-instruct-q4_0"
    temperature: float = 0.3
    max_tokens: int = 150

class LLMResponse(BaseModel):
    response: str
    model: str
    success: bool
    processing_time: float

class OllamaService:
    def __init__(self, base_url: str = "http://ollama:11434"):
        self.base_url = base_url
        self.session = None
    
    async def initialize(self):
        self.session = aiohttp.ClientSession()
        
        # Verificar conexión
        try:
            async with self.session.get(f"{self.base_url}/api/tags") as response:
                if response.status == 200:
                    logger.info("✅ Conexión con Ollama establecida")
                else:
                    raise Exception(f"Ollama no disponible: {response.status}")
        except Exception as e:
            logger.error(f"❌ Error conectando con Ollama: {e}")
            raise
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        import time
        start_time = time.time()
        
        try:
            payload = {
                "model": request.model,
                "prompt": request.prompt,
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": request.max_tokens
                }
            }
            
            async with self.session.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    processing_time = time.time() - start_time
                    
                    return LLMResponse(
                        response=data.get('response', '').strip(),
                        model=request.model,
                        success=True,
                        processing_time=processing_time
                    )
                else:
                    raise HTTPException(
                        status_code=response.status,
                        detail="Error en Ollama"
                    )
                    
        except Exception as e:
            logger.error(f"Error generando respuesta: {e}")
            raise HTTPException(status_code=500, detail=str(e))

# Global service instance
ollama_service = OllamaService()

@app.on_event("startup")
async def startup():
    await ollama_service.initialize()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ollama-llm"}

@app.post("/generate", response_model=LLMResponse)
async def generate_text(request: LLMRequest):
    """Generate text using Ollama"""
    return await ollama_service.generate(request)

@app.get("/models")
async def list_models():
    """List available models"""
    try:
        async with ollama_service.session.get(f"{ollama_service.base_url}/api/tags") as response:
            if response.status == 200:
                data = await response.json()
                return {"models": [model['name'] for model in data.get('models', [])]}
            else:
                raise HTTPException(status_code=response.status, detail="Cannot fetch models")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3007)
