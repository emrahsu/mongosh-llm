import 'dotenv/config';
import {
  appConfigSchema,
  DEFAULT_ANTHROPIC_MODEL,
  type AppConfig,
  type QueryMode,
} from '@emrahsu/mongosh-llm-shared';

export interface ConfigOverrides {
  queryMode?: QueryMode;
}

/** Loads and validates configuration from environment variables, with optional CLI overrides. */
export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const raw = {
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    backendUrl: process.env.BACKEND_URL || undefined,
    queryMode: overrides.queryMode ?? (process.env.QUERY_MODE as QueryMode | undefined) ?? 'safe',
  };

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${messages}`);
  }
  return result.data;
}
