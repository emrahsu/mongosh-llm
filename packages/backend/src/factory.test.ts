import { describe, it, expect } from 'vitest';
import type { BackendConfig } from './config.js';
import { createLlmClient } from './factory.js';
import { ClaudeProxy } from './llm.js';
import { BedrockLlmClient } from './bedrock-client.js';

const base: BackendConfig = {
  port: 3000,
  llmProvider: 'anthropic',
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-test',
  rateLimitMax: 20,
};

describe('createLlmClient', () => {
  it('builds a ClaudeProxy in anthropic mode', () => {
    const client = createLlmClient(base);
    expect(client).toBeInstanceOf(ClaudeProxy);
  });

  it('builds a BedrockLlmClient in bedrock mode', () => {
    const client = createLlmClient({
      ...base,
      llmProvider: 'bedrock',
      bedrockModelId: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
      awsRegion: 'eu-central-1',
    });
    expect(client).toBeInstanceOf(BedrockLlmClient);
  });
});
