import type { QueryMode, QueryValidationResult } from '@emrahsu/mongosh-llm-shared';

const WRITE_OPERATION_PATTERN =
  /\b(insert(One|Many)?|bulkWrite|update(One|Many)?|replaceOne|findOneAndUpdate|findOneAndDelete|delete(One|Many)?|remove|drop(Database|Collection|Index|Indexes)?|create(Collection|Index|Indexes)|renameCollection|collMod)\s*\(/;

const PIPELINE_WRITE_STAGE_PATTERN = /\$(out|merge)\b/;

/** True if the query string contains any recognizable write/destructive operation. */
export function isWriteOperation(query: string): boolean {
  return WRITE_OPERATION_PATTERN.test(query) || PIPELINE_WRITE_STAGE_PATTERN.test(query);
}

/** Defense-in-depth check run before executing any generated command, independent of the LLM. */
export function validateQuery(query: string, queryMode: QueryMode): QueryValidationResult {
  if (!isWriteOperation(query)) {
    return { allowed: true };
  }

  if (queryMode === 'safe') {
    return {
      allowed: false,
      reason: 'This is a read-only connection. Write operations are blocked in safe mode.',
    };
  }

  return { allowed: true, reason: 'This command modifies data - confirmation required.' };
}
