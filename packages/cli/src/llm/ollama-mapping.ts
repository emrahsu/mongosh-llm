import type Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage } from '@emrahsu/mongosh-llm-shared';

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

/** Converts our Anthropic-shaped tool definition into Ollama/OpenAI-style function schema. */
export function toOllamaTool(tool: Anthropic.Tool): OllamaTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.input_schema,
    },
  };
}

/** Flattens our Anthropic-shaped conversation (with tool_use/tool_result blocks) into Ollama's message list. */
export function toOllamaMessages(system: string, messages: ConversationMessage[]): OllamaMessage[] {
  const ollamaMessages: OllamaMessage[] = [{ role: 'system', content: system }];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      ollamaMessages.push({ role: message.role, content: message.content });
      continue;
    }

    const textParts: string[] = [];
    const toolCalls: OllamaToolCall[] = [];

    for (const block of message.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({ function: { name: block.name, arguments: block.input as Record<string, unknown> } });
      } else if (block.type === 'tool_result') {
        const resultText =
          typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        ollamaMessages.push({ role: 'tool', content: resultText });
      }
    }

    if (textParts.length > 0 || toolCalls.length > 0) {
      ollamaMessages.push({
        role: message.role,
        content: textParts.join('\n'),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    }
  }

  return ollamaMessages;
}

/** Converts Ollama's response message back into Anthropic-shaped content blocks. */
export function fromOllamaMessage(message: {
  content?: string;
  tool_calls?: OllamaToolCall[];
}): Anthropic.ContentBlock[] {
  const blocks: Anthropic.ContentBlock[] = [];

  if (message.content && message.content.trim()) {
    blocks.push({ type: 'text', text: message.content, citations: [] } as unknown as Anthropic.ContentBlock);
  }

  (message.tool_calls ?? []).forEach((call, index) => {
    const input =
      typeof call.function.arguments === 'string'
        ? safeJsonParse(call.function.arguments)
        : call.function.arguments;
    blocks.push({
      type: 'tool_use',
      id: `ollama-tool-${index}-${Date.now()}`,
      name: call.function.name,
      input,
    } as unknown as Anthropic.ContentBlock);
  });

  return blocks;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
