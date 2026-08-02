import type Anthropic from '@anthropic-ai/sdk';

/** "safe" rejects write operations; "unsafe" allows them (with CLI confirmation). */
export type QueryMode = 'safe' | 'unsafe';

export interface AppConfig {
  mongodbUri: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  backendUrl?: string;
  queryMode: QueryMode;
}

/** A single conversation turn, reusing Anthropic's own message shape directly. */
export type ConversationMessage = Anthropic.MessageParam;

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
  truncated: boolean;
  error?: string;
}

export interface QueryValidationResult {
  allowed: boolean;
  reason?: string;
}

export type LlmResponseType = 'command' | 'text' | 'tool_use';

export interface LlmResponse {
  type: LlmResponseType;
  content: string;
  toolCalls?: Anthropic.ToolUseBlock[];
}

/**
 * A single stateless turn: send the already-built system prompt + message history, get back
 * Claude's raw content blocks. Both the direct-Anthropic client and the backend proxy implement
 * this same shape, so the CLI's tool-use loop works identically in either mode.
 */
export interface LlmTurnRequest {
  system: string;
  messages: ConversationMessage[];
}

export interface LlmTurnResult {
  content: Anthropic.ContentBlock[];
}

export interface LlmClient {
  sendTurn(request: LlmTurnRequest): Promise<LlmTurnResult>;
}
