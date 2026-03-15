import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

// ================================
// IMPORTS INTERNOS
// ================================
import { errorHandler, requestLogger, responseFormatter } from './middleware/index';
import { initializeConnections, closeDatabases } from './database/connections';
import { eventService } from './services/event.service';
import config from './config';

// ================================
// FUNCIÓN PRINCIPAL DE ARRANQUE
// ================================

const app = express();
const server = createServer(app);

async function startServer() {
  try {
    // ================================
    // MIDDLEWARE DE SEGURIDAD Y GENERAL
    // ================================
    app.set('trust proxy', 1);
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    const corsOptions = {
      origin: function (origin: string | undefined, callback: Function) {
        const allowedOrigins = config.corsOrigin.map((o: string) => o.trim());
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
    };
    app.use(cors(corsOptions));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 1000,
      message: { success: false, message: 'Demasiadas solicitudes desde esta IP', error: 'RATE_LIMIT_EXCEEDED' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(requestLogger); 
    app.use(responseFormatter);

    // ================================
    // HEALTH CHECK ENDPOINT (After CORS middleware)
    // ================================
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // ================================
    // CONEXIÓN A BASES DE DATOS (Paso Crítico)
    // ================================
    console.log('🚀 Iniciando servicio...');
    console.log('📊 Conectando a bases de datos...');
    await initializeConnections();
    console.log('✅ Bases de datos conectadas');

    // ================================
    // INICIALIZAR EVENT SERVICE (Kafka)
    // ================================
    console.log('📨 Inicializando EventService...');
    try {
      await eventService.initialize();
      console.log('✅ EventService inicializado');
    } catch (error) {
      console.warn('⚠️ EventService no pudo iniciarse (continuará sin Kafka):', error);
    }

    // ================================
    // INICIALIZAR SISTEMA (Roles por defecto, etc.)
    // ================================
    console.log('🔧 Inicializando sistema...');
    // try {
    //   const { systemInitializer } = await import('./utils/initialization');
    //   await systemInitializer.initializeSystem();
    //   console.log('✅ Sistema inicializado');
    // } catch (error) {
    //   console.warn('⚠️ Advertencias durante inicialización del sistema:', error);
    //   // No detener el servidor por errores en la inicialización
    // }

    // ================================
    // RUTAS (Se cargan DESPUÉS de conectar a la BD)
    // ================================
    // Usamos import() dinámico para asegurar que los controladores se instancien
    // después de que la conexión a la base de datos esté lista.
    const routes = (await import('./routes/index')).default;
    app.use('/', routes);

    // ================================
    // MIDDLEWARE DE ERROR (Debe ir al final)
    // ================================
    app.use(errorHandler);

    // ================================
    // INICIAR SERVIDOR
    // ================================
    const port = config.port;
    server.listen(port, () => {
      console.log(`\n🎯 ========================================`);
      console.log(`   USER MANAGEMENT SERVICE INICIADO`);
      console.log(`========================================`);
      console.log(`📍 Puerto: ${port}`);
      console.log(`🌍 Entorno: ${config.nodeEnv}`);
      console.log(`🕒 Fecha: ${new Date().toISOString()}`);
      console.log(`📊 MongoDB: Conectado`);
      console.log(`🔴 Redis: Conectado`);
      console.log(`📨 Kafka: ${eventService.getConnectionStatus().initialized ? 'Conectado' : 'Desconectado'}`);
      console.log(`🔒 CORS Origins: ${config.corsOrigin}`);
      console.log(`📋 Health Check: http://localhost:${port}/health`);
      console.log(`📚 API Base: http://localhost:${port}/`);
      console.log(`🎯 ========================================\n`);
    });

  } catch (error) {
    console.error('❌ Error fatal iniciando el servicio:', error);
    process.exit(1);
  }
}

// ================================
// MANEJO DE SEÑALES (Graceful Shutdown)
// ================================
async function shutdown(signal: string) {
  console.log(`\n📡 Señal ${signal} recibida. Iniciando apagado graceful...`);
  try {
    // Desconectar EventService primero
    console.log('📨 Desconectando EventService...');
    try {
      await eventService.disconnect();
      console.log('✅ EventService desconectado');
    } catch (error) {
      console.warn('⚠️ Error desconectando EventService:', error);
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    console.log('✅ Servidor HTTP cerrado');
    
    await closeDatabases(); // Cierra todas las conexiones de BD
    
    console.log('✅ Apagado graceful completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el apagado:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

// ================================
// EJECUTAR LA APLICACIÓN
// ================================
startServer();

export { app, server };
export default app;
