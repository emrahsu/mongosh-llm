import type { AppConfig, LlmClient, LlmProvider } from '@emrahsu/mongosh-llm-shared';
import { AnthropicDirectClient } from './anthropic-direct-client.js';
import { BackendLlmClient } from './backend-client.js';
import { OllamaLlmClient } from './ollama-client.js';

/**
 * Resolves which LlmClient to use. An explicit LLM_PROVIDER wins; otherwise falls back to
 * inferring from which config values are set (Anthropic key > backend URL > Ollama URL), which
 * keeps old configs working unchanged now that a third provider exists.
 */
export function createLlmClient(config: AppConfig): LlmClient {
  const provider = config.llmProvider ?? inferProvider(config);

  switch (provider) {
    case 'anthropic':
      return new AnthropicDirectClient(config.anthropicApiKey as string, config.anthropicModel);
    case 'backend':
      return new BackendLlmClient(config.backendUrl as string);
    case 'ollama':
      return new OllamaLlmClient(config.ollamaBaseUrl as string, config.ollamaModel);
  }
}

function inferProvider(config: AppConfig): LlmProvider {
  if (config.anthropicApiKey) {
    return 'anthropic';
  }
  if (config.backendUrl) {
    return 'backend';
  }
  if (config.ollamaBaseUrl) {
    return 'ollama';
  }
  throw new Error('No LLM provider configured. Set ANTHROPIC_API_KEY, BACKEND_URL, or OLLAMA_BASE_URL.');
}
