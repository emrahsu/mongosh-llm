import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createAuthMiddleware } from './auth.js';

function mockReqRes(headerValue?: string) {
  const req = { header: vi.fn().mockReturnValue(headerValue) } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, json };
}

describe('createAuthMiddleware', () => {
  it('allows all requests through when no API key is configured', () => {
    const middleware = createAuthMiddleware(undefined);
    const { req, res, next } = mockReqRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects requests missing the X-API-Key header', () => {
    const middleware = createAuthMiddleware('secret');
    const { req, res, next } = mockReqRes(undefined);

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects requests with the wrong X-API-Key value', () => {
    const middleware = createAuthMiddleware('secret');
    const { req, res, next } = mockReqRes('wrong-value');

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows requests with the correct X-API-Key value', () => {
    const middleware = createAuthMiddleware('secret');
    const { req, res, next } = mockReqRes('secret');

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
