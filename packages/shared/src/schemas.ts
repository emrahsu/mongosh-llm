import { z } from 'zod';

export const queryModeSchema = z.enum(['safe', 'unsafe']);

export const llmProviderSchema = z.enum(['anthropic', 'backend', 'ollama']);

/**
 * Validated at process startup. refine() enforces that at least one provider is actually
 * reachable: an Anthropic key, a backend URL, or a local Ollama URL.
 */
export const appConfigSchema = z
  .object({
    mongodbUri: z.string().min(1, 'MONGODB_URI is required'),
    llmProvider: llmProviderSchema.optional(),
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().min(1),
    backendUrl: z.string().url().optional(),
    ollamaBaseUrl: z.string().url().optional(),
    ollamaModel: z.string().min(1),
    queryMode: queryModeSchema.default('safe'),
  })
  .refine(
    (config) =>
      Boolean(config.anthropicApiKey) || Boolean(config.backendUrl) || Boolean(config.ollamaBaseUrl),
    { message: 'One of ANTHROPIC_API_KEY, BACKEND_URL, or OLLAMA_BASE_URL must be set' },
  );

export const toolExecutionResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  truncated: z.boolean(),
  error: z.string().optional(),
});

/**
 * Shape of the request the CLI sends to the optional backend's /query endpoint. The backend is a
 * stateless single-turn Claude proxy: the CLI already built the full system prompt (schema and
 * safe/unsafe rules baked in) and just needs the backend to hold the Anthropic API key and make
 * the call. Message content blocks are passed through as-is and validated by the Anthropic SDK.
 */
export const backendQueryRequestSchema = z.object({
  system: z.string().min(1),
  messages: z.array(z.unknown()),
});

export const backendQueryResponseSchema = z.object({
  content: z.array(z.unknown()),
});

