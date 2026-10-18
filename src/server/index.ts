import 'dotenv/config';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager } from '@/storage/database';
import { logger } from '@/server/logger';
import { getConfig } from '@/config';
import authRoutes from './routes/auth.js';
import analyticsRoutes from './routes/analytics.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const config = getConfig();

const app: Express = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: config.NODE_ENV === 'production' ? false : true,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug({
      method: req.method,
      url: req.url,
      status: _res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }, 'HTTP Request');
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  const dbHealthy = DatabaseManager.getInstance().healthCheck();
  res.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve static files (React build) in production
if (config.NODE_ENV === 'production') {
  const publicDir = resolve(__dirname, '../public');
  app.use(express.static(publicDir, { maxAge: '1y', etag: true }));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path === '/health') {
      return next();
    }
    res.sendFile(resolve(publicDir, 'index.html'));
  });
}

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
function startServer(): Promise<void> {
  return new Promise((resolve) => {
    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info({
        host: config.HOST,
        port: config.PORT,
        env: config.NODE_ENV,
      }, 'Server started');
      resolve();
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info({ signal }, 'Shutting down...');
      server.close(() => {
        DatabaseManager.getInstance().close();
        logger.info('Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}

// Initialize database and start
async function main() {
  try {
    // Initialize database
    DatabaseManager.getInstance().getDb();
    await startServer();
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();

export { app };