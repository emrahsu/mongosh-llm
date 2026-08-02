import { describe, it, expect } from 'vitest';
import { maskConnectionString, maskErrorMessage } from './security.js';

describe('maskConnectionString', () => {
  it('masks credentials in a standard connection string', () => {
    const uri = 'mongodb://username:password@cluster.mongodb.net/database';
    expect(maskConnectionString(uri)).toBe('mongodb://***@cluster.mongodb.net/database');
  });

  it('masks credentials in an srv connection string', () => {
    const uri = 'mongodb+srv://user:pass@cluster.net/?retryWrites=true';
    expect(maskConnectionString(uri)).toBe('mongodb+srv://***@cluster.net/?retryWrites=true');
  });

  it('leaves local connections without credentials unchanged', () => {
    const uri = 'mongodb://localhost:27017/test';
    expect(maskConnectionString(uri)).toBe(uri);
  });
});

describe('maskErrorMessage', () => {
  it('replaces the raw connection string with a masked one', () => {
    const conn = 'mongodb://user:pass@host/db';
    const error = `Failed to connect to ${conn}`;
    expect(maskErrorMessage(error, conn)).toBe('Failed to connect to mongodb://***@host/db');
  });
});
