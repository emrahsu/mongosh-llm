import { describe, it, expect, vi } from 'vitest';
import { printPaginated, printToolUse, printToolResult } from './display.js';

describe('printPaginated', () => {
  it('prints short text in a single call without prompting', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ask = vi.fn();

    await printPaginated('line one\nline two', ask);

    expect(ask).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('line one\nline two');
    logSpy.mockRestore();
  });

  it('paginates long text and stops early if the user quits', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const lines = Array.from({ length: 250 }, (_, i) => `line-${i}`);
    const ask = vi.fn().mockResolvedValueOnce('q');

    await printPaginated(lines.join('\n'), ask);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1); // first page printed, then stopped before the second
    logSpy.mockRestore();
  });

  it('stops gracefully if the ask prompt throws (stdin closed)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const lines = Array.from({ length: 250 }, (_, i) => `line-${i}`);
    const ask = vi.fn().mockRejectedValueOnce(new Error('readline was closed'));

    await expect(printPaginated(lines.join('\n'), ask)).resolves.toBeUndefined();
    logSpy.mockRestore();
  });
});

describe('printToolUse', () => {
  it('shows the query without a cache indicator when not cached', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolUse('db.users.findOne()', false);
    expect(logSpy.mock.calls[0]?.[0]).toContain('db.users.findOne()');
    expect(logSpy.mock.calls[0]?.[0]).not.toContain('[cached]');
    logSpy.mockRestore();
  });

  it('shows a [cached] indicator when the result came from cache', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolUse('db.users.findOne()', true);
    expect(logSpy.mock.calls[0]?.[0]).toContain('[cached]');
    logSpy.mockRestore();
  });
});

describe('printToolResult', () => {
  it('summarizes an array result with item count', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolResult({ success: true, data: [1, 2, 3], truncated: false });
    expect(logSpy.mock.calls[0]?.[0]).toContain('Returned 3 items');
    logSpy.mockRestore();
  });

  it('summarizes an object result with field count', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolResult({ success: true, data: { a: 1, b: 2 }, truncated: false });
    expect(logSpy.mock.calls[0]?.[0]).toContain('Returned object with 2 fields');
    logSpy.mockRestore();
  });

  it('appends a truncation warning when the result was truncated', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolResult({ success: true, data: [1], truncated: true });
    expect(logSpy.mock.calls[0]?.[0]).toContain('Truncated to limit');
    logSpy.mockRestore();
  });

  it('shows an error line for failed results', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printToolResult({ success: false, data: null, truncated: false, error: 'connection refused' });
    expect(logSpy.mock.calls[0]?.[0]).toContain('Error: connection refused');
    logSpy.mockRestore();
  });
});
