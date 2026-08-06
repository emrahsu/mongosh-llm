import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_ANTHROPIC_MODEL } from '@emrah.su/mongosh-llm-shared';

const backendLlmProviderSchema = z.enum(['anthropic', 'bedrock']);
export type BackendLlmProvider = z.infer<typeof backendLlmProviderSchema>;

const backendConfigSchema = z
  .object({
    port: z.coerce.number().int().positive().default(3000),
    llmProvider: backendLlmProviderSchema.default('anthropic'),
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().min(1),
    bedrockModelId: z.string().optional(),
    awsRegion: z.string().optional(),
    apiKey: z.string().optional(),
    rateLimitMax: z.coerce.number().int().positive().default(20),
    /**
     * Read-only connection string. When set, the backend exposes /execute so CLI users never need
     * database credentials of their own. Should belong to a user with only the `read` role.
     */
    mongodbUri: z.string().min(1).optional(),
    /**
     * Optional read-write connection string. Leaving this unset (recommended) makes unsafe mode
     * impossible to use against this backend, regardless of what any client asks for.
     */
    mongodbUriUnsafe: z.string().min(1).optional(),
  })
  .refine((data) => data.llmProvider !== 'anthropic' || Boolean(data.anthropicApiKey), {
    message: 'ANTHROPIC_API_KEY is required to run the backend in anthropic mode',
    path: ['anthropicApiKey'],
  })
  .refine((data) => data.llmProvider !== 'bedrock' || Boolean(data.bedrockModelId), {
    message: 'BEDROCK_MODEL_ID is required to run the backend in bedrock mode',
    path: ['bedrockModelId'],
  })
  .refine((data) => data.llmProvider !== 'bedrock' || Boolean(data.awsRegion), {
    message: 'AWS_REGION is required to run the backend in bedrock mode',
    path: ['awsRegion'],
  });

export type BackendConfig = z.infer<typeof backendConfigSchema>;

/** Loads and validates backend configuration; throws a readable error if misconfigured. */
export function loadBackendConfig(): BackendConfig {
  const raw = {
    port: process.env.PORT || 3000,
    llmProvider: process.env.LLM_PROVIDER || 'anthropic',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    bedrockModelId: process.env.BEDROCK_MODEL_ID || undefined,
    awsRegion: process.env.AWS_REGION || undefined,
    apiKey: process.env.API_KEY || undefined,
    rateLimitMax: process.env.RATE_LIMIT_MAX || 20,
    mongodbUri: process.env.MONGODB_URI || undefined,
    mongodbUriUnsafe: process.env.MONGODB_URI_UNSAFE || undefined,
  };

  const result = backendConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`Invalid backend configuration:\n${messages}`);
  }
  return result.data;
}
