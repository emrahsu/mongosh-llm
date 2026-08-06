import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOL_RESULT_MAX_DOCS, type ToolExecutionResult } from '@emrah.su/mongosh-llm-shared';

const execFileAsync = promisify(execFile);

const TOOL_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * Runs queries through the real mongosh binary, mirroring the CLI's local runner exactly. Using
 * mongosh (rather than the driver) is deliberate: the system prompt teaches Claude mongosh-specific
 * syntax (ISODate(), getSiblingDB(), JSON.stringify wrapping), so swapping in the driver would
 * silently break generated commands.
 */
export class MongoRunner {
  constructor(private readonly mongodbUri: string) {}

  /** The database name from the connection string's path, for the prompt's "connected db" hint. */
  getDatabaseName(): string | undefined {
    try {
      return new URL(this.mongodbUri).pathname.replace(/^\//, '') || undefined;
    } catch {
      return undefined;
    }
  }

  async fetchSchema(): Promise<string> {
    return this.runEval('JSON.stringify(db.getCollectionNames(), null, 2);', TOOL_TIMEOUT_MS);
  }

  /** Read-only inspection query for the run_query loop; never throws, reports failure in-band. */
  async executeToolQuery(query: string): Promise<ToolExecutionResult> {
    try {
      const stdout = await this.runEval(ensureLimit(query, TOOL_RESULT_MAX_DOCS), TOOL_TIMEOUT_MS);
      return { success: true, data: safeJsonParse(stdout), truncated: false };
    } catch (error) {
      return {
        success: false,
        data: null,
        truncated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** The final user-facing command; returns raw stdout so the CLI can display it verbatim. */
  async executeCommand(command: string): Promise<string> {
    return this.runEval(command, COMMAND_TIMEOUT_MS);
  }

  private async runEval(code: string, timeoutMs: number): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'mongosh',
        [this.mongodbUri, '--quiet', '--eval', code],
        { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
      );
      return stdout.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Never let the connection string reach a client - mongosh echoes it in some error paths.
      throw new Error(scrubUri(message, this.mongodbUri));
    }
  }
}

/**
 * Removes the connection string (and any credentials in it) from text bound for a client. Replaces
 * the whole URI rather than just the password, since even the host is not the operator's business.
 */
export function scrubUri(text: string, mongodbUri: string): string {
  return text.split(mongodbUri).join('<connection string hidden>');
}

/** Safety net matching the CLI: caps bare find() calls used for schema inspection. */
function ensureLimit(query: string, maxDocs: number): string {
  if (/\.limit\s*\(/.test(query) || !/\.find\s*\(/.test(query)) {
    return query;
  }
  return query.replace(/\.find\(([^]*?)\)/, `.find($1).limit(${maxDocs})`);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
