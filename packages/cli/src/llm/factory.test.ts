import { describe, it, expect } from 'vitest';
import type { AppConfig } from '@emrah.su/mongosh-llm-shared';
import { createLlmClient } from './factory.js';
import { AnthropicDirectClient } from './anthropic-direct-client.js';
import { BackendLlmClient } from './backend-client.js';
import { OllamaLlmClient } from './ollama-client.js';

const base: AppConfig = {
  mongodbUri: 'mongodb://localhost:27017/test',
  anthropicModel: 'claude-test',
  ollamaModel: 'mistral-nemo',
  queryMode: 'safe',
};

describe('createLlmClient', () => {
  it('infers Anthropic direct mode when an API key is set', () => {
    const client = createLlmClient({ ...base, anthropicApiKey: 'key' });
    expect(client).toBeInstanceOf(AnthropicDirectClient);
  });

  it('infers backend mode when only a backend URL is set', () => {
    const client = createLlmClient({ ...base, backendUrl: 'http://localhost:3000' });
    expect(client).toBeInstanceOf(BackendLlmClient);
  });

  it('infers Ollama mode when only an Ollama URL is set', () => {
    const client = createLlmClient({ ...base, ollamaBaseUrl: 'http://localhost:11434' });
    expect(client).toBeInstanceOf(OllamaLlmClient);
  });

  it('honors an explicit llmProvider over inference', () => {
    const client = createLlmClient({
      ...base,
      anthropicApiKey: 'key',
      ollamaBaseUrl: 'http://localhost:11434',
      llmProvider: 'ollama',
    });
    expect(client).toBeInstanceOf(OllamaLlmClient);
  });

  it('throws when nothing is configured', () => {
    expect(() => createLlmClient(base)).toThrow(/No LLM provider configured/);
  });
});
