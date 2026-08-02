import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOL_RESULT_MAX_DOCS, type ToolExecutionResult } from '@emrahsu/mongosh-llm-shared';
import { maskErrorMessage } from '../security.js';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 30_000;
const TOOL_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export class MongoshNotFoundError extends Error {
  constructor() {
    super('mongosh was not found on PATH. Install it: https://www.mongodb.com/try/download/shell');
    this.name = 'MongoshNotFoundError';
  }
}

/** Runs a JS snippet through the real mongosh binary and returns raw stdout. */
async function runEval(mongodbUri: string, code: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout } = await execFileAsync('mongosh', [mongodbUri, '--quiet', '--eval', code], {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    return stdout.trim();
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      throw new MongoshNotFoundError();
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(maskErrorMessage(message, mongodbUri));
  }
}

function isCommandNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

/** Fetches collection names and one sample document per collection as a schema summary. */
export async function fetchSchema(mongodbUri: string): Promise<string> {
  const code = `
    const names = db.getCollectionNames();
    const summary = names.map((name) => ({
      collection: name,
      sampleDocument: db.getCollection(name).findOne(),
    }));
    JSON.stringify(summary, null, 2);
  `;
  return runEval(mongodbUri, code);
}

/** Executes a read-only, schema-inspection style query used by the run_query tool. */
export async function executeToolQuery(mongodbUri: string, query: string): Promise<ToolExecutionResult> {
  const limitedQuery = ensureLimit(query, TOOL_RESULT_MAX_DOCS);
  try {
    const stdout = await runEval(mongodbUri, limitedQuery, TOOL_TIMEOUT_MS);
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

/** Executes the final user-facing command and returns its raw stdout for display. */
export async function executeCommand(mongodbUri: string, command: string): Promise<string> {
  return runEval(mongodbUri, command, COMMAND_TIMEOUT_MS);
}

/** Best-effort safety net: appends a doc limit to bare .find() calls used for schema inspection. */
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
