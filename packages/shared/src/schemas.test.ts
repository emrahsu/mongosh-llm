import { describe, it, expect } from 'vitest';
import { appConfigSchema, backendQueryRequestSchema } from './schemas.js';

describe('appConfigSchema', () => {
  const base = {
    mongodbUri: 'mongodb://localhost:27017/test',
    anthropicModel: 'claude-test',
  };

  it('rejects config with neither an API key nor a backend URL', () => {
    expect(appConfigSchema.safeParse(base).success).toBe(false);
  });

  it('accepts config with only an Anthropic API key', () => {
    expect(appConfigSchema.safeParse({ ...base, anthropicApiKey: 'key' }).success).toBe(true);
  });

  it('accepts config with only a backend URL', () => {
    expect(appConfigSchema.safeParse({ ...base, backendUrl: 'http://localhost:3000' }).success).toBe(
      true,
    );
  });

  it('defaults queryMode to safe', () => {
    const result = appConfigSchema.safeParse({ ...base, anthropicApiKey: 'key' });
    expect(result.success && result.data.queryMode).toBe('safe');
  });
});

describe('backendQueryRequestSchema', () => {
  it('requires system and messages', () => {
    expect(backendQueryRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a minimal valid request', () => {
    const result = backendQueryRequestSchema.safeParse({ system: 'sys', messages: [] });
    expect(result.success).toBe(true);
  });
});
