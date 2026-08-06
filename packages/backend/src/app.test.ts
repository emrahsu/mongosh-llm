import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { BackendConfig } from './config.js';

const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const { createApp } = await import('./app.js');

const baseConfig: BackendConfig = {
  port: 0,
  llmProvider: 'anthropic',
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-test',
  apiKey: undefined,
  rateLimitMax: 20,
};

beforeEach(() => {
  createMock.mockReset();
});

describe('GET /health', () => {
  it('returns ok without touching Claude', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('POST /query', () => {
  it('returns 400 for a request missing required fields', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).post('/query').send({});
    expect(res.status).toBe(400);
  });

  it('proxies a valid request to Claude and returns its content blocks', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'hello' }] });
    const app = createApp(baseConfig);

    const res = await request(app)
      .post('/query')
      .send({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ content: [{ type: 'text', text: 'hello' }] });
  });

  it('returns 502 when the Claude call fails', async () => {
    createMock.mockRejectedValue(new Error('authentication_error'));
    const app = createApp(baseConfig);

    const res = await request(app).post('/query').send({ system: 'sys', messages: [] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('authentication_error');
  });

  it('enforces X-API-Key when the backend is configured with one', async () => {
    const app = createApp({ ...baseConfig, apiKey: 'secret' });

    const withoutKey = await request(app).post('/query').send({ system: 'sys', messages: [] });
    expect(withoutKey.status).toBe(401);

    createMock.mockResolvedValue({ content: [] });
    const withKey = await request(app)
      .post('/query')
      .set('x-api-key', 'secret')
      .send({ system: 'sys', messages: [] });
    expect(withKey.status).toBe(200);
  });
});

describe('query execution routes', () => {
  it('are absent when no connection string is configured, exposing no database surface', async () => {
    const app = createApp(baseConfig);

    expect((await request(app).post('/execute').send({ query: 'db.x.find()' })).status).toBe(404);
    expect((await request(app).get('/connection-info')).status).toBe(404);
    expect((await request(app).get('/schema')).status).toBe(404);
  });

  it('are mounted once a connection string is configured', async () => {
    const app = createApp({ ...baseConfig, mongodbUri: 'mongodb://localhost:27017/testdb' });

    const res = await request(app).get('/connection-info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ databaseName: 'testdb', unsafeAvailable: false });
  });

  it('require the API key like /query does', async () => {
    const app = createApp({
      ...baseConfig,
      apiKey: 'secret',
      mongodbUri: 'mongodb://localhost:27017/testdb',
    });

    expect((await request(app).get('/connection-info')).status).toBe(401);
    expect((await request(app).post('/execute').send({ query: 'db.x.find()' })).status).toBe(401);
    expect((await request(app).get('/connection-info').set('x-api-key', 'secret')).status).toBe(200);
  });

  it('advertises unsafe mode only when a read-write connection string is configured', async () => {
    const app = createApp({
      ...baseConfig,
      mongodbUri: 'mongodb://localhost:27017/testdb',
      mongodbUriUnsafe: 'mongodb://localhost:27017/testdb',
    });

    const res = await request(app).get('/connection-info');

    expect(res.body.unsafeAvailable).toBe(true);
  });
});
