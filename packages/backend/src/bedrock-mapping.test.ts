import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage } from '@emrah.su/mongosh-llm-shared';
import { toBedrockTool, toBedrockMessages, fromBedrockMessage } from './bedrock-mapping.js';

describe('toBedrockTool', () => {
  it('converts an Anthropic tool into a Bedrock toolSpec', () => {
    const tool: Anthropic.Tool = {
      name: 'run_query',
      description: 'Run a query',
      input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    };
    expect(toBedrockTool(tool)).toEqual({
      toolSpec: {
        name: 'run_query',
        description: 'Run a query',
        inputSchema: { json: tool.input_schema },
      },
    });
  });
});

describe('toBedrockMessages', () => {
  it('converts string content messages', () => {
    const messages: ConversationMessage[] = [{ role: 'user', content: 'hello' }];
    expect(toBedrockMessages(messages)).toEqual([{ role: 'user', content: [{ text: 'hello' }] }]);
  });

  it('converts text blocks', () => {
    const messages: ConversationMessage[] = [
      { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] },
    ];
    expect(toBedrockMessages(messages)).toEqual([
      { role: 'assistant', content: [{ text: 'hi there' }] },
    ]);
  });

  it('converts tool_use blocks', () => {
    const messages: ConversationMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'run_query', input: { query: 'db.foo.find()' } }],
      },
    ];
    expect(toBedrockMessages(messages)).toEqual([
      {
        role: 'assistant',
        content: [{ toolUse: { toolUseId: 'tool-1', name: 'run_query', input: { query: 'db.foo.find()' } } }],
      },
    ]);
  });

  it('converts successful tool_result blocks with object content as json', () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: JSON.stringify({ n: 1 }) }],
      },
    ];
    expect(toBedrockMessages(messages)).toEqual([
      {
        role: 'user',
        content: [{ toolResult: { toolUseId: 'tool-1', content: [{ text: JSON.stringify({ n: 1 }) }] } }],
      },
    ]);
  });

  it('marks failed tool_result blocks with status error', () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'boom', is_error: true }],
      },
    ];
    expect(toBedrockMessages(messages)).toEqual([
      {
        role: 'user',
        content: [{ toolResult: { toolUseId: 'tool-1', content: [{ text: 'boom' }], status: 'error' } }],
      },
    ]);
  });
});

describe('fromBedrockMessage', () => {
  it('converts a text block into an Anthropic text content block', () => {
    const blocks = fromBedrockMessage({ role: 'assistant', content: [{ text: 'the answer' }] });
    expect(blocks).toEqual([{ type: 'text', text: 'the answer', citations: [] }]);
  });

  it('converts a toolUse block into an Anthropic tool_use content block', () => {
    const blocks = fromBedrockMessage({
      role: 'assistant',
      content: [{ toolUse: { toolUseId: 'tool-1', name: 'run_query', input: { query: 'db.foo.find()' } } }],
    });
    expect(blocks).toEqual([
      { type: 'tool_use', id: 'tool-1', name: 'run_query', input: { query: 'db.foo.find()' } },
    ]);
  });

  it('returns an empty array when the message is undefined', () => {
    expect(fromBedrockMessage(undefined)).toEqual([]);
  });
});
