import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

const { fetchSchema, executeToolQuery, executeCommand, MongoshNotFoundError } = await import('./client.js');

type ExecCallback = (error: unknown, result?: { stdout: string; stderr: string }) => void;

function mockSuccess(stdout: string): void {
  execFileMock.mockImplementation((...args: unknown[]) => {
    (args.at(-1) as ExecCallback)(null, { stdout, stderr: '' });
  });
}

function mockFailure(error: unknown): void {
  execFileMock.mockImplementation((...args: unknown[]) => {
    (args.at(-1) as ExecCallback)(error);
  });
}

beforeEach(() => {
  execFileMock.mockReset();
});

describe('fetchSchema', () => {
  it('returns mongosh stdout trimmed', async () => {
    mockSuccess('  [{"collection":"users"}]  \n');
    const result = await fetchSchema('mongodb://localhost/test');
    expect(result).toBe('[{"collection":"users"}]');
  });
});

describe('executeToolQuery', () => {
  it('parses JSON stdout and reports success', async () => {
    mockSuccess('{"count":5}');
    const result = await executeToolQuery('mongodb://localhost/test', 'db.users.countDocuments()');
    expect(result).toEqual({ success: true, data: { count: 5 }, truncated: false });
  });

  it('returns success:false with a message when mongosh fails', async () => {
    mockFailure(new Error('boom'));
    const result = await executeToolQuery('mongodb://localhost/test', 'db.users.find()');
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('injects a limit into a bare find() call', async () => {
    mockSuccess('[]');
    await executeToolQuery('mongodb://localhost/test', 'db.users.find()');
    const [, evalArgs] = execFileMock.mock.calls[0] as [string, string[]];
    const query = evalArgs[evalArgs.indexOf('--eval') + 1];
    expect(query).toContain('.limit(1000)');
  });

  it('does not double-inject a limit if one is already present', async () => {
    mockSuccess('[]');
    await executeToolQuery('mongodb://localhost/test', 'db.users.find().limit(5)');
    const [, evalArgs] = execFileMock.mock.calls[0] as [string, string[]];
    const query = evalArgs[evalArgs.indexOf('--eval') + 1];
    expect(query).toBe('db.users.find().limit(5)');
  });
});

describe('executeCommand', () => {
  it('throws MongoshNotFoundError when the binary is missing', async () => {
    mockFailure(Object.assign(new Error('not found'), { code: 'ENOENT' }));
    await expect(executeCommand('mongodb://localhost/test', 'db.users.find()')).rejects.toThrow(
      MongoshNotFoundError,
    );
  });

  it('masks credentials in a thrown error message', async () => {
    mockFailure(new Error('Failed: mongodb://user:pass@host/db'));
    await expect(
      executeCommand('mongodb://user:pass@host/db', 'db.users.find()'),
    ).rejects.toThrow('mongodb://***@host/db');
  });
});
