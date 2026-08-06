import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { createConnectionInfoHandler, createExecuteHandler, createSchemaHandler } from './execute.js';
import type { MongoRunner } from '../mongo-runner.js';

const executeToolQuery = vi.fn();
const executeCommand = vi.fn();
const fetchSchema = vi.fn();

function fakeRunner(databaseName = 'proddb'): MongoRunner {
  return {
    getDatabaseName: () => databaseName,
    fetchSchema: () => fetchSchema(),
    executeToolQuery: (q: string) => executeToolQuery(q),
    executeCommand: (q: string) => executeCommand(q),
  } as unknown as MongoRunner;
}

function appWith(readOnly: MongoRunner, readWrite?: MongoRunner): Express {
  const app = express();
  app.use(express.json());
  app.get('/connection-info', createConnectionInfoHandler(readOnly, readWrite));
  app.get('/schema', createSchemaHandler(readOnly));
  app.post('/execute', createExecuteHandler(readOnly, readWrite));
  return app;
}

beforeEach(() => {
  executeToolQuery.mockReset();
  executeCommand.mockReset();
  fetchSchema.mockReset();
});

describe('POST /execute', () => {
  it('runs a read-only tool query and passes the result through', async () => {
    executeToolQuery.mockResolvedValue({ success: true, data: [{ n: 1 }], truncated: false });

    const res = await request(appWith(fakeRunner()))
      .post('/execute')
      .send({ query: 'db.orders.findOne()', kind: 'tool', queryMode: 'safe' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ n: 1 }], truncated: false });
  });

  it('returns raw stdout for a final command', async () => {
    executeCommand.mockResolvedValue('[{"_id":1}]');

    const res = await request(appWith(fakeRunner()))
      .post('/execute')
      .send({ query: 'db.orders.find()', kind: 'command', queryMode: 'safe' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('[{"_id":1}]');
  });

  it('rejects a write operation in safe mode even though the CLI should have caught it', async () => {
    const res = await request(appWith(fakeRunner()))
      .post('/execute')
      .send({ query: 'db.orders.deleteMany({})', kind: 'command', queryMode: 'safe' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/read-only/i);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('refuses unsafe mode outright when no read-write connection is configured', async () => {
    const res = await request(appWith(fakeRunner()))
      .post('/execute')
      .send({ query: 'db.orders.deleteMany({})', kind: 'command', queryMode: 'unsafe' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/read-only/i);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('routes an unsafe write to the read-write runner when one is configured', async () => {
    const rwExecuteCommand = vi.fn().mockResolvedValue('{"deletedCount":2}');
    const readWrite = { ...fakeRunner(), executeCommand: rwExecuteCommand } as unknown as MongoRunner;

    const res = await request(appWith(fakeRunner(), readWrite))
      .post('/execute')
      .send({ query: 'db.orders.deleteMany({})', kind: 'command', queryMode: 'unsafe' });

    expect(res.status).toBe(200);
    expect(rwExecuteCommand).toHaveBeenCalled();
    // The read-only runner must not be used for a write.
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('still uses the read-only runner for reads when a read-write one exists', async () => {
    executeToolQuery.mockResolvedValue({ success: true, data: [], truncated: false });
    const rwToolQuery = vi.fn();
    const readWrite = { ...fakeRunner(), executeToolQuery: rwToolQuery } as unknown as MongoRunner;

    await request(appWith(fakeRunner(), readWrite))
      .post('/execute')
      .send({ query: 'db.orders.find()', kind: 'tool', queryMode: 'safe' });

    expect(executeToolQuery).toHaveBeenCalled();
    expect(rwToolQuery).not.toHaveBeenCalled();
  });

  it('rejects an empty query', async () => {
    const res = await request(appWith(fakeRunner())).post('/execute').send({ query: '' });
    expect(res.status).toBe(400);
  });

  it('defaults to a safe read-only tool query when kind and mode are omitted', async () => {
    executeToolQuery.mockResolvedValue({ success: true, data: [], truncated: false });

    const res = await request(appWith(fakeRunner())).post('/execute').send({ query: 'db.x.find()' });

    expect(res.status).toBe(200);
    expect(executeToolQuery).toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('reports a 502 when running the command throws', async () => {
    executeCommand.mockRejectedValue(new Error('connection refused'));

    const res = await request(appWith(fakeRunner()))
      .post('/execute')
      .send({ query: 'db.x.find()', kind: 'command' });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('connection refused');
  });
});

describe('GET /connection-info', () => {
  it('returns the database name but never the connection string', async () => {
    const res = await request(appWith(fakeRunner('proddb'))).get('/connection-info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ databaseName: 'proddb', unsafeAvailable: false });
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb(\+srv)?:\/\//);
  });

  it('advertises unsafe availability when a read-write connection is configured', async () => {
    const res = await request(appWith(fakeRunner(), fakeRunner())).get('/connection-info');
    expect(res.body.unsafeAvailable).toBe(true);
  });
});

describe('GET /schema', () => {
  it('returns collection names', async () => {
    fetchSchema.mockResolvedValue('["orders"]');
    const res = await request(appWith(fakeRunner())).get('/schema');
    expect(res.status).toBe(200);
    expect(res.body.schema).toBe('["orders"]');
  });

  it('reports a 502 when the schema fetch fails', async () => {
    fetchSchema.mockRejectedValue(new Error('unreachable'));
    const res = await request(appWith(fakeRunner())).get('/schema');
    expect(res.status).toBe(502);
  });
});
