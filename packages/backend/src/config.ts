import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_ANTHROPIC_MODEL } from '@emrahsu/mongosh-llm-shared';

const backendConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  anthropicApiKey: z
    .string({ required_error: 'ANTHROPIC_API_KEY is required to run the backend' })
    .min(1, 'ANTHROPIC_API_KEY is required to run the backend'),
  anthropicModel: z.string().min(1),
  apiKey: z.string().optional(),
  rateLimitMax: z.coerce.number().int().positive().default(20),
});

export type BackendConfig = z.infer<typeof backendConfigSchema>;

/** Loads and validates backend configuration; throws a readable error if misconfigured. */
export function loadBackendConfig(): BackendConfig {
  const raw = {
    port: process.env.PORT || 3000,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    apiKey: process.env.API_KEY || undefined,
    rateLimitMax: process.env.RATE_LIMIT_MAX || 20,
  };

  const result = backendConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Invalid backend configuration:\n${messages}`);
  }
  return result.data;
}
