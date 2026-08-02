import { describe, it, expect } from 'vitest';
import { isWriteOperation, validateQuery } from './validation.js';

describe('isWriteOperation', () => {
  it.each([
    'db.users.insertOne({})',
    'db.users.insertMany([])',
    'db.users.updateOne({}, {})',
    'db.users.deleteMany({})',
    'db.users.drop()',
    'db.users.aggregate([{ $out: "copy" }])',
    'db.users.aggregate([{ $merge: "copy" }])',
  ])('flags "%s" as a write operation', (query) => {
    expect(isWriteOperation(query)).toBe(true);
  });

  it.each([
    'db.users.find({})',
    'db.users.findOne()',
    'db.users.countDocuments()',
    'db.users.aggregate([{ $match: {} }])',
  ])('does not flag "%s" as a write operation', (query) => {
    expect(isWriteOperation(query)).toBe(false);
  });
});

describe('validateQuery', () => {
  it('allows read-only queries in safe mode', () => {
    expect(validateQuery('db.users.find({})', 'safe')).toEqual({ allowed: true });
  });

  it('rejects write operations in safe mode', () => {
    const result = validateQuery('db.users.deleteMany({})', 'safe');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/read-only/i);
  });

  it('allows write operations in unsafe mode but flags confirmation is needed', () => {
    const result = validateQuery('db.users.deleteMany({})', 'unsafe');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it('allows read-only queries in unsafe mode without a confirmation reason', () => {
    expect(validateQuery('db.users.find({})', 'unsafe')).toEqual({ allowed: true });
  });
});
