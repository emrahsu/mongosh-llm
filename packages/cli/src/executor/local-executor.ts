import type { ToolExecutionResult } from '@emrah.su/mongosh-llm-shared';
import {
  executeCommand,
  executeToolQuery,
  fetchSchema,
  parseDatabaseName,
} from '../mongosh/client.js';
import type { QueryExecutor } from './types.js';

/**
 * Runs queries through a local `mongosh` binary - the original (and default) behaviour. The user
 * supplies MONGODB_URI themselves, so this mode requires both mongosh on PATH and direct network
 * access to the database.
 */
export class LocalMongoshExecutor implements QueryExecutor {
  readonly isRemote = false;

  constructor(private readonly mongodbUri: string) {}

  async getDatabaseName(): Promise<string | undefined> {
    return parseDatabaseName(this.mongodbUri);
  }

  async fetchSchema(): Promise<string> {
    return fetchSchema(this.mongodbUri);
  }

  async executeToolQuery(query: string): Promise<ToolExecutionResult> {
    return executeToolQuery(this.mongodbUri, query);
  }

  async executeCommand(command: string): Promise<string> {
    return executeCommand(this.mongodbUri, command);
  }
}
