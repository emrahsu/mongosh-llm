import type { LlmClient, LlmTurnRequest, LlmTurnResult } from '@emrah.su/mongosh-llm-shared';
import { RUN_QUERY_TOOL } from '@emrah.su/mongosh-llm-shared';
import { toOllamaMessages, toOllamaTool, fromOllamaMessage, type OllamaToolCall } from './ollama-mapping.js';

interface OllamaChatResponse {
  message: {
    role: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
}

/** Talks to a local Ollama server instead of a cloud provider - free and private, but less reliable. */
export class OllamaLlmClient implements LlmClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async sendTurn({ system, messages }: LlmTurnRequest): Promise<LlmTurnResult> {
    const url = new URL('/api/chat', this.baseUrl);
    const body = {
      model: this.model,
      messages: toOllamaMessages(system, messages),
      tools: [toOllamaTool(RUN_QUERY_TOOL)],
      stream: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Ollama request failed (${response.status}): ${text || response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return { content: fromOllamaMessage(data.message) };
  }
}
