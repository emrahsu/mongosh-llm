import Anthropic from '@anthropic-ai/sdk';
import {
  RUN_QUERY_TOOL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  type LlmClient,
  type LlmTurnRequest,
  type LlmTurnResult,
} from '@emrahsu/mongosh-llm-shared';

/** Calls Anthropic directly using the user's own API key - no backend involved. */
export class AnthropicDirectClient implements LlmClient {
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
      messages,
      tools: [RUN_QUERY_TOOL],
    });
    return { content: response.content };
  }
}
