import type { LlmClient, LlmTurnRequest, LlmTurnResult } from '@emrahsu/mongosh-llm-shared';

/** Calls a self-hosted backend instead of Anthropic directly, so the API key never leaves the server. */
export class BackendLlmClient implements LlmClient {
  constructor(private readonly backendUrl: string) {}

  async sendTurn(request: LlmTurnRequest): Promise<LlmTurnResult> {
    const url = new URL('/query', this.backendUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Backend request failed (${response.status}): ${body || response.statusText}`);
    }

    return (await response.json()) as LlmTurnResult;
  }
}
