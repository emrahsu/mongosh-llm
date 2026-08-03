import { describe, it, expect, vi } from 'vitest';
import type { ConversationMessage } from '@emrah.su/mongosh-llm-shared';

const send = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send = send;
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { BedrockLlmClient } = await import('./bedrock-client.js');

describe('BedrockLlmClient', () => {
  it('sends a Converse request and maps the response back to Anthropic-shaped content blocks', async () => {
    send.mockResolvedValueOnce({
      output: { message: { role: 'assistant', content: [{ text: 'db.foo.find()' }] } },
    });

    const client = new BedrockLlmClient('eu-central-1', 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0');
    const messages: ConversationMessage[] = [{ role: 'user', content: 'show me foo' }];
    const result = await client.sendTurn({ system: 'you are a helper', messages });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.content).toEqual([{ type: 'text', text: 'db.foo.find()', citations: [] }]);
  });
});
