import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDB, closeDB } from './db/connection.js';
import { gradingRouter } from './routes/grading.routes.js';

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '20mb' })); // listening audio can be several MB as base64

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'grading-service', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/grading', gradingRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Start
async function main() {
  await connectDB();
  console.log('[grading-service] MongoDB conectado');

  app.listen(config.port, () => {
    console.log(`[grading-service] Escuchando en puerto ${config.port}`);
    console.log(`[grading-service] Endpoints:`);
    console.log(`  POST /api/v1/grading/exam      - Calificar examen completo`);
    console.log(`  POST /api/v1/grading/question   - Evaluar pregunta individual`);
    console.log(`  POST /api/v1/grading/feedback   - Generar feedback con IA`);
    console.log(`  GET  /api/v1/grading/pending    - Listar examenes pendientes`);
    console.log(`  GET  /health                    - Health check`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[grading-service] Cerrando...');
    await closeDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[grading-service] Error al iniciar:', error);
  process.exit(1);
});
