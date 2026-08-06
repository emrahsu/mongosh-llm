import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Onboarding writes to a real per-user path; keep these tests reading an empty stored config so
// they exercise env-var handling only and never touch the developer's own config file.
vi.mock('./config-store.js', () => ({
  readStoredConfig: () => ({}),
  getConfigPath: () => '/tmp/mongosh-llm-test/config.json',
  writeStoredConfig: () => undefined,
}));

const { ConfigNotFoundError, loadConfig } = await import('./config.js');

const ENV_KEYS = [
  'MONGODB_URI',
  'EXECUTION_MODE',
  'LLM_PROVIDER',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'BACKEND_URL',
  'BACKEND_API_KEY',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'QUERY_MODE',
] as const;
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
  it('signals nothing-configured with ConfigNotFoundError so the caller can offer onboarding', () => {
    expect(() => loadConfig()).toThrow(ConfigNotFoundError);
  });

  it('defaults to local execution when a connection string is present', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    expect(loadConfig().executionMode).toBe('local');
  });

  it('infers backend execution when only a backend URL is configured', () => {
    process.env.BACKEND_URL = 'http://localhost:3000';
    const config = loadConfig();
    expect(config.executionMode).toBe('backend');
    // No connection string should be invented in backend mode - the backend owns it.
    expect(config.mongodbUri).toBeUndefined();
  });

  it('keeps local execution when both a connection string and a backend URL are set', () => {
    process.env.BACKEND_URL = 'http://localhost:3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/mine';
    expect(loadConfig().executionMode).toBe('local');
  });

  it('lets EXECUTION_MODE override the inference', () => {
    process.env.BACKEND_URL = 'http://localhost:3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/mine';
    process.env.EXECUTION_MODE = 'backend';
    expect(loadConfig().executionMode).toBe('backend');
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

  it('does not infer Ollama mode just because OLLAMA_MODEL is set without a base URL', () => {
    process.env.OLLAMA_MODEL = 'mistral-nemo';
    expect(() => loadConfig()).toThrow();
  });

  it('defaults OLLAMA_BASE_URL to localhost when LLM_PROVIDER=ollama is explicit', () => {
    process.env.LLM_PROVIDER = 'ollama';
    const config = loadConfig();
    expect(config.ollamaBaseUrl).toBe('http://localhost:11434');
  });

  it('accepts an explicit OLLAMA_BASE_URL directly', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const config = loadConfig();
    expect(config.ollamaBaseUrl).toBe('http://localhost:11434');
    expect(config.ollamaModel).toBe('mistral-nemo');
  });
});
