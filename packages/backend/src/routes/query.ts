import type { Request, Response } from 'express';
import { backendQueryRequestSchema, type ConversationMessage } from '@emrah.su/mongosh-llm-shared';
import type { ClaudeProxy } from '../llm.js';

/** POST /query: stateless single-turn proxy - validate, call Claude once, return raw content blocks. */
export function createQueryHandler(claude: ClaudeProxy) {
  return async (req: Request, res: Response): Promise<void> => {
    const parseResult = backendQueryRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
      return;
    }

    try {
      // messages are intentionally passed through loosely-validated - the Anthropic SDK itself
      // rejects malformed content blocks, so we don't duplicate that validation here.
      const result = await claude.sendTurn({
        system: parseResult.data.system,
        messages: parseResult.data.messages as ConversationMessage[],
      });
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'LLM request failed' });
    }
  };
}
