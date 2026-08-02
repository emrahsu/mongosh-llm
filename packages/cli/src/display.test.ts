import { describe, it, expect, vi } from 'vitest';
import { printPaginated } from './display.js';

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
