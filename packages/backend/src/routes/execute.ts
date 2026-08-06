import type { Request, Response } from 'express';
import { executeRequestSchema, validateQuery } from '@emrah.su/mongosh-llm-shared';
import type { MongoRunner } from '../mongo-runner.js';

/**
 * POST /execute - runs a query against the connection string the backend holds.
 *
 * Re-validates every query server-side. The CLI validates too, but that check is advisory only:
 * anything can POST here, so this is where safe mode is actually enforced. The last line of defense
 * is still the database user's own permissions - `unsafe` is refused outright unless the operator
 * has explicitly configured a separate read-write connection string.
 */
export function createExecuteHandler(readOnly: MongoRunner, readWrite?: MongoRunner) {
  return async (req: Request, res: Response): Promise<void> => {
    const parseResult = executeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
      return;
    }

    const { query, kind, queryMode } = parseResult.data;

    if (queryMode === 'unsafe' && !readWrite) {
      res.status(403).json({
        error: 'This backend is configured read-only; unsafe mode is not available.',
      });
      return;
    }

    const validation = validateQuery(query, queryMode);
    if (!validation.allowed) {
      res.status(403).json({ error: validation.reason ?? 'This command is not allowed.' });
      return;
    }

    const runner = queryMode === 'unsafe' && readWrite ? readWrite : readOnly;

    try {
      if (kind === 'command') {
        const stdout = await runner.executeCommand(query);
        res.json({ success: true, data: stdout, truncated: false });
        return;
      }
      // Tool queries report failure in-band rather than throwing, so pass the result through as-is.
      res.json(await runner.executeToolQuery(query));
    } catch (error) {
      res.status(502).json({
        success: false,
        data: null,
        truncated: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
      });
    }
  };
}

/** GET /connection-info - non-secret facts the CLI needs; never exposes the connection string. */
export function createConnectionInfoHandler(readOnly: MongoRunner, readWrite?: MongoRunner) {
  return (_req: Request, res: Response): void => {
    res.json({
      databaseName: readOnly.getDatabaseName(),
      unsafeAvailable: Boolean(readWrite),
    });
  };
}

/** GET /schema - collection names for the CLI's system prompt. */
export function createSchemaHandler(readOnly: MongoRunner) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({ schema: await readOnly.fetchSchema() });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Schema fetch failed',
      });
    }
  };
}
