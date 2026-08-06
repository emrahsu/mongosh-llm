import { describe, it, expect } from 'vitest';
import { MongoRunner, scrubUri } from './mongo-runner.js';

const URI = 'mongodb+srv://readonly:s3cret@cluster0.abcd.mongodb.net/proddb?retryWrites=true';

describe('scrubUri', () => {
  it('removes the whole connection string, not just the password', () => {
    const scrubbed = scrubUri(`MongoServerError connecting to ${URI}`, URI);
    expect(scrubbed).not.toContain('s3cret');
    expect(scrubbed).not.toContain('cluster0.abcd.mongodb.net');
    expect(scrubbed).toContain('<connection string hidden>');
  });

  it('removes every occurrence', () => {
    const scrubbed = scrubUri(`${URI} failed, retrying ${URI}`, URI);
    expect(scrubbed).not.toContain('s3cret');
  });

  it('leaves unrelated text untouched', () => {
    expect(scrubUri('unrelated error', URI)).toBe('unrelated error');
  });
});

describe('MongoRunner.getDatabaseName', () => {
  it('extracts the database from the connection string path', () => {
    expect(new MongoRunner(URI).getDatabaseName()).toBe('proddb');
  });

  it('returns undefined when the connection string names no database', () => {
    expect(new MongoRunner('mongodb://localhost:27017').getDatabaseName()).toBeUndefined();
  });

  it('returns undefined for an unparseable connection string instead of throwing', () => {
    expect(new MongoRunner('nonsense').getDatabaseName()).toBeUndefined();
  });
});
