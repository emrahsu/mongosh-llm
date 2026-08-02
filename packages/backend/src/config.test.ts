import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadBackendConfig } from './config.js';

const ENV_KEYS = ['PORT', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'API_KEY', 'RATE_LIMIT_MAX'] as const;
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

describe('loadBackendConfig', () => {
  it('throws a clear error when ANTHROPIC_API_KEY is missing', () => {
    expect(() => loadBackendConfig()).toThrow(/ANTHROPIC_API_KEY is required/);
  });

  it('applies defaults for port and rate limit', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const config = loadBackendConfig();
    expect(config.port).toBe(3000);
    expect(config.rateLimitMax).toBe(20);
    expect(config.apiKey).toBeUndefined();
  });

  it('reads overrides from environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.PORT = '4000';
    process.env.API_KEY = 'secret';
    process.env.RATE_LIMIT_MAX = '5';
    const config = loadBackendConfig();
    expect(config.port).toBe(4000);
    expect(config.apiKey).toBe('secret');
    expect(config.rateLimitMax).toBe(5);
  });
});
