import type { NextFunction, Request, Response } from 'express';

/** Only enforced when the operator sets API_KEY; otherwise the endpoint is open (e.g. local dev). */
export function createAuthMiddleware(apiKey: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!apiKey) {
      next();
      return;
    }
    if (req.header('x-api-key') !== apiKey) {
      res.status(401).json({ error: 'Invalid or missing X-API-Key header' });
      return;
    }
    next();
  };
}
