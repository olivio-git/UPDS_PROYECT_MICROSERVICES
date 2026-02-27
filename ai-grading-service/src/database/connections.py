from motor.motor_asyncio import AsyncIOMotorClient
from redis import asyncio as aioredis
from typing import Optional
import logging
from ..config.settings import settings

logger = logging.getLogger(__name__)

class DatabaseConnections:
    """
    Singleton para manejar conexiones a bases de datos
    Siguiendo el patrón de los servicios Node.js existentes
    """
    _instance: Optional['DatabaseConnections'] = None
    _mongodb_client: Optional[AsyncIOMotorClient] = None
    _redis_client: Optional[aioredis.Redis] = None

    def __new__(cls) -> 'DatabaseConnections':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls) -> 'DatabaseConnections':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def connect_mongodb(self) -> AsyncIOMotorClient:
        """Connect to MongoDB"""
        try:
            if self._mongodb_client is None:
                # Use settings.mongodb_url (current name) for connection
                logger.info(f"🔌 Conectando a MongoDB: {settings.mongodb_url}")
                self._mongodb_client = AsyncIOMotorClient(settings.mongodb_url)
                
                # Test connection
                await self._mongodb_client.admin.command('ping')
                logger.info("✅ Conexión a MongoDB establecida")
            
                return self._mongodb_client
        except Exception as e:
            logger.error(f"❌ Error conectando a MongoDB: {e}")
            raise

    async def connect_redis(self) -> aioredis.Redis:
        """Connect to Redis"""
        try:
            if self._redis_client is None:
                # Use settings.redis_url (current name) for connection
                logger.info(f"🔌 Conectando a Redis: {settings.redis_url}")
                self._redis_client = aioredis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_keepalive=True,
                    socket_keepalive_options={},
                    health_check_interval=30,
                )
                
                # Test connection
                await self._redis_client.ping()
                logger.info("✅ Conexión a Redis establecida")
            
            return self._redis_client
        except Exception as e:
            logger.error(f"❌ Error conectando a Redis: {e}")
            raise

    def get_mongodb_database(self):
        """Get MongoDB database instance"""
        if self._mongodb_client is None:
            raise RuntimeError("MongoDB client not initialized. Call connect_mongodb() first.")
        # Use settings.mongodb_db_name (current name)
        return self._mongodb_client[settings.mongodb_db_name]

    async def get_mongodb_collection(self, collection_name: str):
        """Get MongoDB collection"""
        db = self.get_mongodb_database()
        return db[collection_name]

    async def close_connections(self):
        """Close all database connections"""
        try:
            if self._mongodb_client:
                self._mongodb_client.close()
                logger.info("🔌 Conexión MongoDB cerrada")
            
            if self._redis_client:
                await self._redis_client.close()
                logger.info("🔌 Conexión Redis cerrada")
                
        except Exception as e:
            logger.error(f"❌ Error cerrando conexiones: {e}")

    async def health_check(self) -> dict:
        """Check database connections health"""
        health = {
            "mongodb": False,
            "redis": False
        }
        
        try:
            # MongoDB health check
            if self._mongodb_client:
                await self._mongodb_client.admin.command('ping')
                health["mongodb"] = True
        except Exception as e:
            logger.error(f"MongoDB health check failed: {e}")
        
        try:
            # Redis health check
            if self._redis_client:
                await self._redis_client.ping()
                health["redis"] = True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
        
        return health

# Global database connections instance
db_connections = DatabaseConnections.get_instance()
