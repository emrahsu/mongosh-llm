import 'dotenv/config';
import {
  appConfigSchema,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  type AppConfig,
  type LlmProvider,
  type QueryMode,
} from '@emrahsu/mongosh-llm-shared';

export interface ConfigOverrides {
  queryMode?: QueryMode;
}

/** Loads and validates configuration from environment variables, with optional CLI overrides. */
export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const llmProvider = (process.env.LLM_PROVIDER as LlmProvider | undefined) || undefined;
  // Only default the URL when Ollama was explicitly selected - otherwise a stray local Ollama
  // instance running for unrelated reasons shouldn't silently become the chosen provider.
  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL || (llmProvider === 'ollama' ? DEFAULT_OLLAMA_BASE_URL : undefined);

  const raw = {
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test',
    llmProvider,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    backendUrl: process.env.BACKEND_URL || undefined,
    ollamaBaseUrl,
    ollamaModel: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    queryMode: overrides.queryMode ?? (process.env.QUERY_MODE as QueryMode | undefined) ?? 'safe',
  };

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${messages}`);
  }
  return result.data;
}
