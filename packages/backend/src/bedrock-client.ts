import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  RUN_QUERY_TOOL,
  DEFAULT_MAX_TOKENS,
  type LlmClient,
  type LlmTurnRequest,
  type LlmTurnResult,
} from '@emrah.su/mongosh-llm-shared';
import { toBedrockMessages, toBedrockTool, fromBedrockMessage } from './bedrock-mapping.js';

/** Talks to Claude via AWS Bedrock's Converse API instead of Anthropic's own API - useful when
 * the operator wants billing/auth to flow through their AWS account (e.g. IAM roles, no API key). */
export class BedrockLlmClient implements LlmClient {
  private readonly client: BedrockRuntimeClient;

  constructor(
    region: string,
    private readonly modelId: string,
  ) {
    this.client = new BedrockRuntimeClient({ region });
  }

  async sendTurn({ system, messages }: LlmTurnRequest): Promise<LlmTurnResult> {
    const command = new ConverseCommand({
      modelId: this.modelId,
      system: [{ text: system }],
      messages: toBedrockMessages(messages),
      toolConfig: { tools: [toBedrockTool(RUN_QUERY_TOOL)] },
      // `temperature` is intentionally omitted - newer Claude models on Bedrock (e.g. sonnet-5)
      // reject it as a deprecated inferenceConfig field.
      inferenceConfig: { maxTokens: DEFAULT_MAX_TOKENS },
    });

    const response = await this.client.send(command);
    return { content: fromBedrockMessage(response.output?.message) };
  }
}
