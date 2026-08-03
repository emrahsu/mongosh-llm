import type { Request, Response } from 'express';
import {
  backendQueryRequestSchema,
  type ConversationMessage,
  type LlmClient,
} from '@emrah.su/mongosh-llm-shared';

/** POST /query: stateless single-turn proxy - validate, call the LLM once, return raw content blocks. */
export function createQueryHandler(llm: LlmClient) {
  return async (req: Request, res: Response): Promise<void> => {
    const parseResult = backendQueryRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
      return;
    }

    try {
      // messages are intentionally passed through loosely-validated - the Anthropic SDK itself
      // rejects malformed content blocks, so we don't duplicate that validation here.
      const result = await llm.sendTurn({
        system: parseResult.data.system,
        messages: parseResult.data.messages as ConversationMessage[],
      });
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'LLM request failed' });
    }
  };
}
