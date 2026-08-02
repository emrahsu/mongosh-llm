import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { BackendConfig } from './config.js';
import { ClaudeProxy } from './llm.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createQueryHandler } from './routes/query.js';

export function createApp(config: BackendConfig): Express {
  const app = express();
  const claude = new ClaudeProxy(config.anthropicApiKey, config.anthropicModel);

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/query', createAuthMiddleware(config.apiKey), createQueryHandler(claude));

  return app;
}
