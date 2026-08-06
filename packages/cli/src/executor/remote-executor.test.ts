import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteQueryExecutor } from './remote-executor.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const URL_BASE = 'https://backend.example.com';

describe('RemoteQueryExecutor', () => {
  it('marks itself remote so the UI can show queries leave the machine', () => {
    expect(new RemoteQueryExecutor(URL_BASE, 'k', 'safe').isRemote).toBe(true);
  });

  it('sends the API key on every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [], truncated: false }));

    await new RemoteQueryExecutor(URL_BASE, 'secret-key', 'safe').executeToolQuery('db.x.find()');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('secret-key');
  });

  it('reads the database name from /connection-info', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ databaseName: 'proddb', unsafeAvailable: false }));

    const name = await new RemoteQueryExecutor(URL_BASE, 'k', 'safe').getDatabaseName();

    expect(name).toBe('proddb');
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe(`${URL_BASE}/connection-info`);
  });

  it('refuses to start in unsafe mode against a read-only backend', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ databaseName: 'proddb', unsafeAvailable: false }));

    await expect(
      new RemoteQueryExecutor(URL_BASE, 'k', 'unsafe').getDatabaseName(),
    ).rejects.toThrow(/read-only/i);
  });

  it('returns tool failures in-band rather than throwing, so the LLM can react', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500));

    const result = await new RemoteQueryExecutor(URL_BASE, 'k', 'safe').executeToolQuery('db.x.find()');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('throws a plain-language error for a bad key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid or missing X-API-Key header' }, 401));

    await expect(
      new RemoteQueryExecutor(URL_BASE, 'wrong', 'safe').executeCommand('db.x.find()'),
    ).rejects.toThrow(/access key/i);
  });

  it('explains that an older backend has no /execute endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    await expect(
      new RemoteQueryExecutor(URL_BASE, 'k', 'safe').executeCommand('db.x.find()'),
    ).rejects.toThrow(/does not support running queries/i);
  });

  it('explains an unreachable backend instead of surfacing "fetch failed"', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      new RemoteQueryExecutor(URL_BASE, 'k', 'safe').executeCommand('db.x.find()'),
    ).rejects.toThrow(/Could not reach the backend/i);
  });

  it('returns command stdout verbatim', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: '[{"n":1}]', truncated: false }));

    const out = await new RemoteQueryExecutor(URL_BASE, 'k', 'safe').executeCommand('db.x.find()');

    expect(out).toBe('[{"n":1}]');
  });

  it('surfaces a failed command as a thrown error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, data: null, truncated: false, error: 'syntax error' }),
    );

    await expect(
      new RemoteQueryExecutor(URL_BASE, 'k', 'safe').executeCommand('db.x.find('),
    ).rejects.toThrow(/syntax error/);
  });

  it('forwards the query mode so the backend can enforce it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [], truncated: false }));

    await new RemoteQueryExecutor(URL_BASE, 'k', 'unsafe').executeToolQuery('db.x.find()');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ queryMode: 'unsafe', kind: 'tool' });
  });
});
