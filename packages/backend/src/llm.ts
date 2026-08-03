import Anthropic from '@anthropic-ai/sdk';
import {
  RUN_QUERY_TOOL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  type ConversationMessage,
  type LlmClient,
  type LlmTurnRequest,
  type LlmTurnResult,
} from '@emrah.su/mongosh-llm-shared';

/** Single-turn Claude proxy: holds the API key server-side, never touches MongoDB directly. */
export class ClaudeProxy implements LlmClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async sendTurn({ system, messages }: LlmTurnRequest): Promise<LlmTurnResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      system,
      messages: messages as ConversationMessage[],
      tools: [RUN_QUERY_TOOL],
    });
    return { content: response.content };
  }
}
