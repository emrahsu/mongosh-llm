import type { AppConfig } from '@emrah.su/mongosh-llm-shared';
import { LocalMongoshExecutor } from './local-executor.js';
import { RemoteQueryExecutor } from './remote-executor.js';
import type { QueryExecutor } from './types.js';

/**
 * Resolves where queries run. Defaults to local mongosh, so existing configs behave exactly as
 * before; EXECUTION_MODE=backend is opt-in for deployments that keep the connection string
 * server-side. The config schema guarantees the values each mode needs are present.
 */
export function createQueryExecutor(config: AppConfig): QueryExecutor {
  if (config.executionMode === 'backend') {
    return new RemoteQueryExecutor(
      config.backendUrl as string,
      config.backendApiKey,
      config.queryMode,
    );
  }
  return new LocalMongoshExecutor(config.mongodbUri as string);
}
