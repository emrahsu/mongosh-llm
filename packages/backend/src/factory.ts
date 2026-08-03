import type { LlmClient } from '@emrah.su/mongosh-llm-shared';
import type { BackendConfig } from './config.js';
import { ClaudeProxy } from './llm.js';
import { BedrockLlmClient } from './bedrock-client.js';

/** Resolves which LlmClient the backend proxies to, based on the configured LLM_PROVIDER. */
export function createLlmClient(config: BackendConfig): LlmClient {
  switch (config.llmProvider) {
    case 'anthropic':
      return new ClaudeProxy(config.anthropicApiKey as string, config.anthropicModel);
    case 'bedrock':
      return new BedrockLlmClient(config.awsRegion as string, config.bedrockModelId as string);
  }
}
