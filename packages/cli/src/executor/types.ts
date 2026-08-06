import type { ToolExecutionResult } from '@emrah.su/mongosh-llm-shared';

/**
 * Abstracts *where* a MongoDB query actually runs, so the tool-use loop doesn't care.
 *
 * Two implementations exist:
 * - LocalMongoshExecutor shells out to a local `mongosh` using a connection string the user holds.
 * - RemoteQueryExecutor posts to a backend that holds the connection string server-side, so
 *   non-technical operators never receive production credentials (and need no mongosh install).
 *
 * Everything above this interface - the tool-use loop, the result cache, the dimmed progress
 * output - is identical in both modes.
 */
export interface QueryExecutor {
  /**
   * The database the queries will run against, used for the system prompt's "connected database"
   * line. Async because the remote executor has to ask the backend; returns undefined when the
   * connection targets no specific database.
   */
  getDatabaseName(): Promise<string | undefined>;

  /** Lightweight schema hint (collection names) injected into the system prompt. */
  fetchSchema(): Promise<string>;

  /** Runs a read-only inspection query for the run_query tool; never throws, reports via `success`. */
  executeToolQuery(query: string): Promise<ToolExecutionResult>;

  /** Runs the final user-facing command and returns raw stdout for display; throws on failure. */
  executeCommand(command: string): Promise<string>;

  /** True when queries leave the machine, so the UI can say so. */
  readonly isRemote: boolean;
}
