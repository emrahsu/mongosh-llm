import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchSchemaMock = vi.fn();
const executeToolQueryMock = vi.fn();
const executeCommandMock = vi.fn();

vi.mock('../mongosh/client.js', () => ({
  fetchSchema: (...args: unknown[]) => fetchSchemaMock(...args),
  executeToolQuery: (...args: unknown[]) => executeToolQueryMock(...args),
  executeCommand: (...args: unknown[]) => executeCommandMock(...args),
  parseDatabaseName: (uri: string) => new URL(uri).pathname.replace(/^\//, '') || undefined,
}));

const { LocalMongoshExecutor } = await import('./local-executor.js');

const URI = 'mongodb://localhost:27017/sample_mflix';

beforeEach(() => {
  fetchSchemaMock.mockReset();
  executeToolQueryMock.mockReset();
  executeCommandMock.mockReset();
});

describe('LocalMongoshExecutor', () => {
  it('reports itself as local so the UI does not mark queries as remote', () => {
    expect(new LocalMongoshExecutor(URI).isRemote).toBe(false);
  });

  it('derives the database name from the connection string', async () => {
    await expect(new LocalMongoshExecutor(URI).getDatabaseName()).resolves.toBe('sample_mflix');
  });

  it('passes the connection string through to each underlying mongosh call', async () => {
    fetchSchemaMock.mockResolvedValue('["users"]');
    executeToolQueryMock.mockResolvedValue({ success: true, data: [], truncated: false });
    executeCommandMock.mockResolvedValue('[]');
    const executor = new LocalMongoshExecutor(URI);

    await executor.fetchSchema();
    await executor.executeToolQuery('db.users.findOne()');
    await executor.executeCommand('db.users.find()');

    expect(fetchSchemaMock).toHaveBeenCalledWith(URI);
    expect(executeToolQueryMock).toHaveBeenCalledWith(URI, 'db.users.findOne()');
    expect(executeCommandMock).toHaveBeenCalledWith(URI, 'db.users.find()');
  });
});
