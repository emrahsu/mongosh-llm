import { z } from 'zod';

export const queryModeSchema = z.enum(['safe', 'unsafe']);

/** Validated at process startup; refine() enforces that a query mode is reachable somehow. */
export const appConfigSchema = z
  .object({
    mongodbUri: z.string().min(1, 'MONGODB_URI is required'),
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().min(1),
    backendUrl: z.string().url().optional(),
    queryMode: queryModeSchema.default('safe'),
  })
  .refine((config) => Boolean(config.anthropicApiKey) || Boolean(config.backendUrl), {
    message: 'Either ANTHROPIC_API_KEY or BACKEND_URL must be set',
  });

export const toolExecutionResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  truncated: z.boolean(),
  error: z.string().optional(),
});

/** Shape of the request the CLI sends to the optional backend's /query endpoint. */
export const backendQueryRequestSchema = z.object({
  prompt: z.string(),
  history: z.array(z.unknown()),
  schema: z.string(),
  queryMode: queryModeSchema.default('safe'),
});
