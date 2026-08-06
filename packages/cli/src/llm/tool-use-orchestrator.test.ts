import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmTurnResult } from '@emrah.su/mongosh-llm-shared';
import type { QueryExecutor } from '../executor/types.js';
import { ToolUseOrchestrator } from './tool-use-orchestrator.js';

const executeToolQueryMock = vi.fn();

/** Stands in for either executor - the orchestrator only ever sees this interface. */
function fakeExecutor(isRemote = false): QueryExecutor {
  return {
    isRemote,
    getDatabaseName: async () => 'test',
    fetchSchema: async () => '',
    executeToolQuery: (query: string) => executeToolQueryMock(query),
    executeCommand: async () => '',
  };
}

function textResult(text: string): LlmTurnResult {
  return { content: [{ type: 'text', text, citations: [] } as unknown as Anthropic.ContentBlock] };
}

function toolUseResult(id: string, query: string): LlmTurnResult {
  return {
    content: [
      { type: 'tool_use', id, name: 'run_query', input: { query } } as unknown as Anthropic.ContentBlock,
    ],
  };
}

function fakeClient(...responses: LlmTurnResult[]): LlmClient {
  const queue = [...responses];
  return {
    sendTurn: vi.fn(async () => {
      const next = queue.shift();
      if (!next) {
        throw new Error('fakeClient: no more mock responses queued');
      }
      return next;
    }),
  };
}

beforeEach(() => {
  executeToolQueryMock.mockReset();
});

describe('ToolUseOrchestrator', () => {
  it('classifies a generated mongosh command as "command"', async () => {
    const client = fakeClient(textResult('JSON.stringify(db.users.find().toArray(), null, 2)'));
    const orchestrator = new ToolUseOrchestrator(client, fakeExecutor());

    const result = await orchestrator.ask([], 'show users', '', 'safe');

    expect(result.type).toBe('command');
  });

  it('classifies a conceptual answer as "text"', async () => {
    const client = fakeClient(textResult('An index speeds up lookups.'));
    const orchestrator = new ToolUseOrchestrator(client, fakeExecutor());

    const result = await orchestrator.ask([], 'what is an index?', '', 'safe');

    expect(result.type).toBe('text');
    expect(result.content).toBe('An index speeds up lookups.');
  });

  it('executes a tool_use call via mongosh before returning the final answer', async () => {
    executeToolQueryMock.mockResolvedValue({ success: true, data: { name: 'users' }, truncated: false });
    const client = fakeClient(
      toolUseResult('tool_1', 'db.users.findOne()'),
      textResult('db.users.find().toArray()'),
    );
    const orchestrator = new ToolUseOrchestrator(client, fakeExecutor());

    const result = await orchestrator.ask([], 'show users', '', 'safe');

    expect(executeToolQueryMock).toHaveBeenCalledWith('db.users.findOne()');
    expect(result.content).toBe('db.users.find().toArray()');
  });

  it('gives up with a text fallback after the max tool-call limit', async () => {
    executeToolQueryMock.mockResolvedValue({ success: true, data: {}, truncated: false });
    const client = fakeClient(...Array.from({ length: 10 }, () => toolUseResult('t', 'db.x.findOne()')));
    const orchestrator = new ToolUseOrchestrator(client, fakeExecutor());

    const result = await orchestrator.ask([], 'show x', '', 'safe');

    expect(result.type).toBe('text');
    expect(result.content).toContain('unable to finish');
  });
});
