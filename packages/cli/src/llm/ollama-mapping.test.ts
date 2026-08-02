import { describe, it, expect } from 'vitest';
import type { ConversationMessage } from '@emrahsu/mongosh-llm-shared';
import { RUN_QUERY_TOOL } from '@emrahsu/mongosh-llm-shared';
import { toOllamaMessages, toOllamaTool, fromOllamaMessage } from './ollama-mapping.js';

describe('toOllamaTool', () => {
  it('converts an Anthropic tool definition into OpenAI/Ollama function schema', () => {
    const result = toOllamaTool(RUN_QUERY_TOOL);
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'run_query',
        description: RUN_QUERY_TOOL.description,
        parameters: RUN_QUERY_TOOL.input_schema,
      },
    });
  });
});

describe('toOllamaMessages', () => {
  it('prepends the system prompt as a system-role message', () => {
    const result = toOllamaMessages('be helpful', []);
    expect(result).toEqual([{ role: 'system', content: 'be helpful' }]);
  });

  it('passes through simple string-content messages unchanged', () => {
    const messages: ConversationMessage[] = [{ role: 'user', content: 'show users' }];
    const result = toOllamaMessages('sys', messages);
    expect(result).toContainEqual({ role: 'user', content: 'show users' });
  });

  it('converts an assistant tool_use block into an assistant message with tool_calls', () => {
    const messages: ConversationMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool_1', name: 'run_query', input: { query: 'db.x.findOne()' } }],
      },
    ];
    const result = toOllamaMessages('sys', messages);
    expect(result).toContainEqual({
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'run_query', arguments: { query: 'db.x.findOne()' } } }],
    });
  });

  it('converts a tool_result block into a separate tool-role message', () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: '{"success":true}' }],
      },
    ];
    const result = toOllamaMessages('sys', messages);
    expect(result).toContainEqual({ role: 'tool', content: '{"success":true}' });
  });
});

describe('fromOllamaMessage', () => {
  it('converts plain text content into a text block', () => {
    const result = fromOllamaMessage({ content: 'hello there' });
    expect(result).toEqual([{ type: 'text', text: 'hello there', citations: [] }]);
  });

  it('converts tool_calls into tool_use blocks with parsed object arguments', () => {
    const result = fromOllamaMessage({
      tool_calls: [{ function: { name: 'run_query', arguments: { query: 'db.x.findOne()' } } }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool_use',
      name: 'run_query',
      input: { query: 'db.x.findOne()' },
    });
  });

  it('parses stringified JSON arguments defensively', () => {
    const result = fromOllamaMessage({
      tool_calls: [{ function: { name: 'run_query', arguments: '{"query":"db.x.findOne()"}' } }],
    });
    expect(result[0]).toMatchObject({ input: { query: 'db.x.findOne()' } });
  });

  it('returns an empty array for an empty message', () => {
    expect(fromOllamaMessage({})).toEqual([]);
  });
});
