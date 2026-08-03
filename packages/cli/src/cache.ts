import { TOOL_CACHE_TTL_MINUTES, type ToolExecutionResult } from '@emrah.su/mongosh-llm-shared';

interface CacheEntry {
  result: ToolExecutionResult;
  expiresAt: number;
}

/** In-memory TTL cache for schema-inspection tool results within a single CLI session. */
export class QueryCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs = TOOL_CACHE_TTL_MINUTES * 60 * 1000;

  get(query: string): ToolExecutionResult | undefined {
    const entry = this.store.get(query);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(query);
      return undefined;
    }
    return entry.result;
  }

  set(query: string, result: ToolExecutionResult): void {
    this.store.set(query, { result, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}
