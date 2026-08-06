import type Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  MAX_TOOL_CALLS_PER_QUERY,
  type ConversationMessage,
  type LlmClient,
  type LlmResponse,
  type QueryMode,
} from '@emrah.su/mongosh-llm-shared';
import type { QueryExecutor } from '../executor/types.js';
import { printToolUse, printToolResult } from '../display.js';
import { QueryCache } from '../cache.js';

/**
 * Drives the run_query tool-use loop against any LlmClient (direct Anthropic or backend proxy).
 * The loop itself always runs client-side; the injected QueryExecutor decides whether the queries
 * it issues hit a local mongosh or a remote backend.
 */
export class ToolUseOrchestrator {
  private readonly cache = new QueryCache();

  constructor(
    private readonly llmClient: LlmClient,
    private readonly executor: QueryExecutor,
    /** Resolved once by the caller, since looking it up may require a network round trip. */
    private readonly currentDatabase?: string,
  ) {}

  async ask(
    history: ConversationMessage[],
    userPrompt: string,
    schema: string,
    queryMode: QueryMode,
  ): Promise<LlmResponse> {
    const system = buildSystemPrompt({ schema, currentDatabase: this.currentDatabase, queryMode });
    const messages: ConversationMessage[] = [...history];
    if (userPrompt.trim()) {
      messages.push({ role: 'user', content: userPrompt });
    }

    for (let toolCallCount = 0; toolCallCount < MAX_TOOL_CALLS_PER_QUERY; toolCallCount++) {
      const { content } = await this.llmClient.sendTurn({ system, messages });

      const toolUseBlocks = content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      if (toolUseBlocks.length === 0) {
        const text = content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();
        return { type: classifyResponse(text), content: text };
      }

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: await this.resolveToolCalls(toolUseBlocks) });
    }

    return {
      type: 'text',
      content:
        'I was unable to finish gathering context within the tool-call limit. Please refine your question.',
    };
  }

  private async resolveToolCalls(
    toolUseBlocks: Anthropic.ToolUseBlock[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const query = (toolUse.input as { query?: string }).query ?? '';
      const cachedResult = this.cache.get(query);
      printToolUse(query, Boolean(cachedResult), this.executor.isRemote);

      const result = cachedResult ?? (await this.executor.executeToolQuery(query));
      if (!cachedResult) {
        this.cache.set(query, result);
      }
      printToolResult(result);

      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: !result.success,
      });
    }
    return results;
  }
}

function classifyResponse(text: string): 'command' | 'text' {
  return /^(JSON\.stringify\(|db\.)/.test(text.trim()) ? 'command' : 'text';
}
