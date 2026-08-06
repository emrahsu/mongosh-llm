import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { BackendConfig } from './config.js';
import { createLlmClient } from './factory.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createQueryHandler } from './routes/query.js';
import {
  createConnectionInfoHandler,
  createExecuteHandler,
  createSchemaHandler,
} from './routes/execute.js';
import { MongoRunner } from './mongo-runner.js';

export function createApp(config: BackendConfig): Express {
  const app = express();
  const llm = createLlmClient(config);

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

  const auth = createAuthMiddleware(config.apiKey);
  app.post('/query', auth, createQueryHandler(llm));

  // Query execution is only mounted when a connection string is configured, so a backend deployed
  // purely as an LLM proxy (the OSS default) exposes no database surface at all.
  if (config.mongodbUri) {
    const readOnly = new MongoRunner(config.mongodbUri);
    const readWrite = config.mongodbUriUnsafe ? new MongoRunner(config.mongodbUriUnsafe) : undefined;

    app.get('/connection-info', auth, createConnectionInfoHandler(readOnly, readWrite));
    app.get('/schema', auth, createSchemaHandler(readOnly));
    app.post('/execute', auth, createExecuteHandler(readOnly, readWrite));
  }

  return app;
}
