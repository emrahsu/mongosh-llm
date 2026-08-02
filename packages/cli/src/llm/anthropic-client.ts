import Anthropic from '@anthropic-ai/sdk';
import {
  RUN_QUERY_TOOL,
  buildSystemPrompt,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MAX_TOOL_CALLS_PER_QUERY,
  type ConversationMessage,
  type LlmResponse,
  type QueryMode,
} from '@emrahsu/mongosh-llm-shared';
import { executeToolQuery } from '../mongosh/client.js';
import { QueryCache } from '../cache.js';

/** Talks to Claude directly, resolving the run_query tool-use loop before returning a final answer. */
export class AnthropicLlmService {
  private readonly client: Anthropic;
  private readonly cache = new QueryCache();

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly mongodbUri: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async ask(
    history: ConversationMessage[],
    userPrompt: string,
    schema: string,
    queryMode: QueryMode,
  ): Promise<LlmResponse> {
    const system = buildSystemPrompt({ schema, queryMode });
    const messages: ConversationMessage[] = [...history];
    if (userPrompt.trim()) {
      messages.push({ role: 'user', content: userPrompt });
    }

    for (let toolCallCount = 0; toolCallCount < MAX_TOOL_CALLS_PER_QUERY; toolCallCount++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        system,
        messages,
        tools: [RUN_QUERY_TOOL],
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      if (toolUseBlocks.length === 0) {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();
        return { type: classifyResponse(text), content: text };
      }

      messages.push({ role: 'assistant', content: response.content });
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
      const result = await this.runToolQuery(query);
      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: !result.success,
      });
    }
    return results;
  }

  private async runToolQuery(query: string) {
    const cached = this.cache.get(query);
    if (cached) {
      return cached;
    }
    const result = await executeToolQuery(this.mongodbUri, query);
    this.cache.set(query, result);
    return result;
  }
}

function classifyResponse(text: string): 'command' | 'text' {
  return /^(JSON\.stringify\(|db\.)/.test(text.trim()) ? 'command' : 'text';
}
