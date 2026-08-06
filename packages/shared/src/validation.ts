import type { QueryMode, QueryValidationResult } from './types.js';

const WRITE_OPERATION_PATTERN =
  /\b(insert(One|Many)?|bulkWrite|update(One|Many)?|replaceOne|findOneAndUpdate|findOneAndDelete|delete(One|Many)?|remove|drop(Database|Collection|Index|Indexes)?|create(Collection|Index|Indexes)|renameCollection|collMod)\s*\(/;

const PIPELINE_WRITE_STAGE_PATTERN = /\$(out|merge)\b/;

/** True if the query string contains any recognizable write/destructive operation. */
export function isWriteOperation(query: string): boolean {
  return WRITE_OPERATION_PATTERN.test(query) || PIPELINE_WRITE_STAGE_PATTERN.test(query);
}

/**
 * Defense-in-depth check run before executing any generated command, independent of the LLM.
 *
 * Lives in `shared` because it must run on BOTH sides: the CLI checks first so the user gets an
 * immediate, friendly refusal, but the backend re-checks every query it receives - a CLI-side-only
 * check is unenforceable once queries execute server-side. Neither check is the last line of
 * defense: the backend's connection string should belong to a read-only database user.
 */
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
