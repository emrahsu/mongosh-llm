import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryCache } from './cache.js';

describe('QueryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a query that was never cached', () => {
    const cache = new QueryCache();
    expect(cache.get('db.users.find()')).toBeUndefined();
  });

  it('returns a cached result before it expires', () => {
    const cache = new QueryCache();
    const result = { success: true, data: [1, 2, 3], truncated: false };
    cache.set('db.users.find()', result);
    expect(cache.get('db.users.find()')).toEqual(result);
  });

  it('expires entries after the TTL', () => {
    const cache = new QueryCache();
    cache.set('db.users.find()', { success: true, data: [], truncated: false });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(cache.get('db.users.find()')).toBeUndefined();
  });

  it('clear() removes all entries', () => {
    const cache = new QueryCache();
    cache.set('db.users.find()', { success: true, data: [], truncated: false });
    cache.clear();
    expect(cache.get('db.users.find()')).toBeUndefined();
  });
});
