import { z } from 'zod';

export const queryModeSchema = z.enum(['safe', 'unsafe']);

export const llmProviderSchema = z.enum(['anthropic', 'backend', 'ollama']);

/** How the CLI reaches MongoDB: locally via mongosh, or by asking the backend to run the query. */
export const executionModeSchema = z.enum(['local', 'backend']);

/**
 * Validated at process startup. refine() enforces that at least one provider is actually
 * reachable: an Anthropic key, a backend URL, or a local Ollama URL.
 */
export const appConfigSchema = z
  .object({
    mongodbUri: z.string().min(1).optional(),
    executionMode: executionModeSchema.default('local'),
    llmProvider: llmProviderSchema.optional(),
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().min(1),
    backendUrl: z.string().url().optional(),
    backendApiKey: z.string().optional(),
    ollamaBaseUrl: z.string().url().optional(),
    ollamaModel: z.string().min(1),
    queryMode: queryModeSchema.default('safe'),
  })
  .refine(
    (config) =>
      Boolean(config.anthropicApiKey) || Boolean(config.backendUrl) || Boolean(config.ollamaBaseUrl),
    { message: 'One of ANTHROPIC_API_KEY, BACKEND_URL, or OLLAMA_BASE_URL must be set' },
  )
  // Only local execution needs a connection string - in backend mode the backend holds it, which is
  // the whole point (operators never receive production credentials).
  .refine((config) => config.executionMode !== 'local' || Boolean(config.mongodbUri), {
    message: 'MONGODB_URI is required when EXECUTION_MODE is "local"',
    path: ['mongodbUri'],
  })
  .refine((config) => config.executionMode !== 'backend' || Boolean(config.backendUrl), {
    message: 'BACKEND_URL is required when EXECUTION_MODE is "backend"',
    path: ['backendUrl'],
  });

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

/**
 * POST /execute - asks the backend to run a query against the connection string it holds. Exists so
 * non-technical operators never receive production database credentials.
 *
 * `kind` mirrors the two distinct call sites in the CLI:
 * - 'tool'    - a read-only inspection query from the run_query loop; capped and never throws.
 * - 'command' - the final user-facing command; returns raw stdout for display.
 */
export const executeRequestSchema = z.object({
  query: z.string().min(1, 'query is required'),
  kind: z.enum(['tool', 'command']).default('tool'),
  queryMode: queryModeSchema.default('safe'),
});

export const executeResponseSchema = z.object({
  success: z.boolean(),
  /** Raw mongosh stdout for kind='command'; parsed JSON for kind='tool'. */
  data: z.unknown(),
  truncated: z.boolean().default(false),
  error: z.string().optional(),
});

/**
 * GET /connection-info - non-secret facts about the backend's database connection. Deliberately
 * excludes the connection string itself; the CLI only needs the database name for the system
 * prompt's "connected database" hint.
 */
export const connectionInfoResponseSchema = z.object({
  databaseName: z.string().optional(),
  /** False when the backend has no read-write connection string configured. */
  unsafeAvailable: z.boolean(),
});

