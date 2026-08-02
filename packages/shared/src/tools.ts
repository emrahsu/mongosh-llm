import type Anthropic from '@anthropic-ai/sdk';
import { MAX_TOOL_CALLS_PER_QUERY, TOOL_RESULT_MAX_DOCS } from './constants.js';

/** Anthropic tool definition for read-only schema/data inspection before the final query. */
export const RUN_QUERY_TOOL: Anthropic.Tool = {
  name: 'run_query',
  description:
    'Execute a READ-ONLY MongoDB query to inspect collection metadata, check indexes, sample ' +
    'documents, or gather context needed to construct an optimized final query. Use this BEFORE ' +
    'generating your final command to understand collection structure, available indexes, and ' +
    `field names. Results limited to ${TOOL_RESULT_MAX_DOCS} documents. Maximum ` +
    `${MAX_TOOL_CALLS_PER_QUERY} tool calls per user query - be efficient.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          "READ-ONLY MongoDB command. Examples: 'db.CollectionName.getIndexes()', " +
          "'db.CollectionName.findOne()', 'db.CollectionName.countDocuments()'. " +
          'NO insert/update/delete/drop operations.',
      },
    },
    required: ['query'],
  },
};
