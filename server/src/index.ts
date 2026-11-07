import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRouter from './routes/api';
import { ENV } from './config/env';

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SONORA Music Streaming API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: ENV.hasSupabase ? 'Supabase PostgreSQL' : 'Local In-Memory Cache (Seamless Fallback)',
    storage: ENV.hasCloudinary ? 'Cloudinary High-Fidelity Streaming' : 'Public CDN / Local Streaming',
  });
});

// API Routes
app.use('/api', apiRouter);

// 404 handler for unknown routes
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server Uncaught Exception:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
const server = app.listen(ENV.PORT, () => {
  console.log(`
  ==============================================================
   🎵  SONORA MUSIC STREAMING BACKEND IS ONLINE
  ==============================================================
   ➜  Port:        http://localhost:${ENV.PORT}
   ➜  Health:      http://localhost:${ENV.PORT}/health
   ➜  API Routes:  http://localhost:${ENV.PORT}/api
   ➜  Supabase:    ${ENV.hasSupabase ? 'Connected' : 'In-Memory Mode (Add keys to .env for DB sync)'}
   ➜  Cloudinary:  ${ENV.hasCloudinary ? 'Configured' : 'Local/Demo mode (Add keys to .env for cloud storage)'}
  ==============================================================
  `);
});

export default app;
