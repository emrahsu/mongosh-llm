import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';

const ENV_KEYS = ['MONGODB_URI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'BACKEND_URL', 'QUERY_MODE'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('loadConfig', () => {
  it('throws when neither ANTHROPIC_API_KEY nor BACKEND_URL is set', () => {
    expect(() => loadConfig()).toThrow(/ANTHROPIC_API_KEY or BACKEND_URL/);
  });

  it('defaults to safe mode and a local MongoDB URI', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const config = loadConfig();
    expect(config.queryMode).toBe('safe');
    expect(config.mongodbUri).toBe('mongodb://localhost:27017/test');
  });

  it('lets a CLI override take precedence over QUERY_MODE env var', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.QUERY_MODE = 'safe';
    const config = loadConfig({ queryMode: 'unsafe' });
    expect(config.queryMode).toBe('unsafe');
  });

  it('accepts backend mode without an API key', () => {
    process.env.BACKEND_URL = 'http://localhost:3000';
    const config = loadConfig();
    expect(config.backendUrl).toBe('http://localhost:3000');
    expect(config.anthropicApiKey).toBeUndefined();
  });
});
