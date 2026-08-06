import {
  connectionInfoResponseSchema,
  executeResponseSchema,
  type QueryMode,
  type ToolExecutionResult,
} from '@emrah.su/mongosh-llm-shared';
import type { QueryExecutor } from './types.js';

/**
 * Asks the backend to run queries against the connection string it holds server-side, so the user
 * needs neither database credentials nor a local mongosh install. The tool-use loop above this is
 * unchanged - only where the query runs differs.
 */
export class RemoteQueryExecutor implements QueryExecutor {
  readonly isRemote = true;

  constructor(
    private readonly backendUrl: string,
    private readonly apiKey: string | undefined,
    private readonly queryMode: QueryMode,
  ) {}

  async getDatabaseName(): Promise<string | undefined> {
    const body = await this.request('GET', '/connection-info');
    const parsed = connectionInfoResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Backend returned an unexpected /connection-info response.');
    }
    if (this.queryMode === 'unsafe' && !parsed.data.unsafeAvailable) {
      throw new Error(
        'This backend is configured read-only, so --unsafe is unavailable. Re-run without --unsafe.',
      );
    }
    return parsed.data.databaseName;
  }

  async fetchSchema(): Promise<string> {
    const body = (await this.request('GET', '/schema')) as { schema?: unknown };
    return typeof body.schema === 'string' ? body.schema : '';
  }

  async executeToolQuery(query: string): Promise<ToolExecutionResult> {
    // Mirrors the local executor's contract: report failure in-band so the LLM can react to it.
    try {
      const body = await this.request('POST', '/execute', {
        query,
        kind: 'tool',
        queryMode: this.queryMode,
      });
      const parsed = executeResponseSchema.safeParse(body);
      if (!parsed.success) {
        return {
          success: false,
          data: null,
          truncated: false,
          error: 'Backend returned an unexpected /execute response.',
        };
      }
      // Rebuilt field by field because Zod treats `z.unknown()` keys as optional, while
      // ToolExecutionResult requires `data` to be present.
      return {
        success: parsed.data.success,
        data: parsed.data.data ?? null,
        truncated: parsed.data.truncated,
        error: parsed.data.error,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        truncated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async executeCommand(command: string): Promise<string> {
    const body = await this.request('POST', '/execute', {
      query: command,
      kind: 'command',
      queryMode: this.queryMode,
    });
    const parsed = executeResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Backend returned an unexpected /execute response.');
    }
    if (!parsed.data.success) {
      throw new Error(parsed.data.error ?? 'Query execution failed.');
    }
    return typeof parsed.data.data === 'string'
      ? parsed.data.data
      : JSON.stringify(parsed.data.data, null, 2);
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    let response: Response;
    try {
      response = await fetch(new URL(path, this.backendUrl), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      // fetch only rejects on network-level failures, which for an operator almost always means
      // the URL is wrong or they're offline - say so rather than surfacing "fetch failed".
      throw new Error(
        `Could not reach the backend at ${this.backendUrl}. Check your connection and that the URL is correct. (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    if (!response.ok) {
      throw new Error(await describeHttpFailure(response));
    }
    return response.json();
  }
}

/** Turns a backend error response into something an operator can act on. */
async function describeHttpFailure(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === 'string') {
      detail = parsed.error;
    }
  } catch {
    // not JSON - fall back to the raw body
  }

  if (response.status === 401) {
    return 'The backend rejected your access key. Re-run `mongosh-llm setup` to update it.';
  }
  if (response.status === 404) {
    return 'This backend does not support running queries (no /execute endpoint). It may be an older version, or configured as an LLM proxy only.';
  }
  if (response.status === 429) {
    return 'Too many requests - the backend is rate limiting. Wait a moment and try again.';
  }
  return `Backend request failed (${response.status}): ${detail || response.statusText}`;
}
