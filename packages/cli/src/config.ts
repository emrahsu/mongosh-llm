import 'dotenv/config';
import {
  appConfigSchema,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  type AppConfig,
  type ExecutionMode,
  type LlmProvider,
  type QueryMode,
} from '@emrah.su/mongosh-llm-shared';
import { readStoredConfig, type StoredConfig } from './config-store.js';

export interface ConfigOverrides {
  queryMode?: QueryMode;
}

/** Thrown when nothing is configured at all, so callers can offer onboarding instead of an error. */
export class ConfigNotFoundError extends Error {
  constructor() {
    super('No configuration found.');
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Loads configuration from, in order of precedence:
 *   1. CLI flags (overrides)
 *   2. environment variables / a `.env` in the working directory
 *   3. the stored per-user config file
 *   4. built-in defaults
 *
 * Env vars deliberately win over the stored file so developers can override a saved setup
 * per-invocation, and so CI keeps working without a config file at all.
 */
export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const stored = readStoredConfig();

  const llmProvider =
    (process.env.LLM_PROVIDER as LlmProvider | undefined) || stored.llmProvider || undefined;
  const backendUrl = process.env.BACKEND_URL || stored.backendUrl || undefined;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || stored.anthropicApiKey || undefined;

  // Only default the URL when Ollama was explicitly selected - otherwise a stray local Ollama
  // instance running for unrelated reasons shouldn't silently become the chosen provider.
  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL ||
    stored.ollamaBaseUrl ||
    (llmProvider === 'ollama' ? DEFAULT_OLLAMA_BASE_URL : undefined);

  const configuredUri = process.env.MONGODB_URI || stored.mongodbUri || undefined;
  const executionMode = resolveExecutionMode(stored, configuredUri, backendUrl);

  if (!anthropicApiKey && !backendUrl && !ollamaBaseUrl) {
    throw new ConfigNotFoundError();
  }

  // Local mode keeps its long-standing localhost default so existing OSS setups are unaffected.
  // Backend mode gets nothing: the backend holds the connection string, and inventing a localhost
  // default there would produce a baffling connection error instead of a clear one.
  const mongodbUri =
    executionMode === 'local' ? (configuredUri ?? 'mongodb://localhost:27017/test') : configuredUri;

  const raw = {
    mongodbUri,
    executionMode,
    llmProvider,
    anthropicApiKey,
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    backendUrl,
    backendApiKey: process.env.BACKEND_API_KEY || stored.backendApiKey || undefined,
    ollamaBaseUrl,
    ollamaModel: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    queryMode:
      overrides.queryMode ??
      (process.env.QUERY_MODE as QueryMode | undefined) ??
      stored.queryMode ??
      'safe',
  };

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${messages}`);
  }
  return result.data;
}

/**
 * Picks where queries run. An explicit setting always wins; otherwise infer from what's available,
 * preferring local execution when the user supplied their own connection string. This keeps every
 * pre-existing config (which had no EXECUTION_MODE) behaving exactly as it did before.
 */
function resolveExecutionMode(
  stored: StoredConfig,
  mongodbUri: string | undefined,
  backendUrl: string | undefined,
): ExecutionMode {
  const explicit = (process.env.EXECUTION_MODE as ExecutionMode | undefined) || stored.executionMode;
  if (explicit) {
    return explicit;
  }
  if (!mongodbUri && backendUrl) {
    return 'backend';
  }
  return 'local';
}
