import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoredConfig } from './config-store.js';

const writeStoredConfigMock = vi.fn();
let storedConfig: StoredConfig = {};

vi.mock('./config-store.js', () => ({
  readStoredConfig: () => storedConfig,
  writeStoredConfig: (config: StoredConfig) => writeStoredConfigMock(config),
  getConfigPath: () => '/tmp/mongosh-llm-test/config.json',
}));

const { runOnboarding } = await import('./onboarding.js');

/** Feeds scripted answers to the wizard in order, as if typed at the prompt. */
function scriptedPrompts(...answers: string[]) {
  const queue = [...answers];
  return {
    ask: async () => queue.shift() ?? '',
    close: () => undefined,
  };
}

beforeEach(() => {
  writeStoredConfigMock.mockReset();
  storedConfig = {};
  delete process.env.MONGOSH_LLM_DEFAULT_BACKEND_URL;
});

describe('runOnboarding', () => {
  it('sets up backend mode without ever asking for a connection string', async () => {
    const saved = await runOnboarding(
      scriptedPrompts('1', 'https://backend.example.com', 'ops-key'),
    );

    expect(saved).toEqual({
      executionMode: 'backend',
      llmProvider: 'backend',
      backendUrl: 'https://backend.example.com',
      backendApiKey: 'ops-key',
      queryMode: 'safe',
    });
    expect(saved).not.toHaveProperty('mongodbUri');
    expect(writeStoredConfigMock).toHaveBeenCalledWith(saved);
  });

  it('defaults to backend mode when the user just presses enter', async () => {
    const saved = await runOnboarding(scriptedPrompts('', 'https://backend.example.com', 'k'));
    expect(saved?.executionMode).toBe('backend');
  });

  it('strips a trailing slash from the backend URL so path joining stays predictable', async () => {
    const saved = await runOnboarding(scriptedPrompts('1', 'https://backend.example.com/', 'k'));
    expect(saved?.backendUrl).toBe('https://backend.example.com');
  });

  it('re-asks when the backend URL is not a URL', async () => {
    const saved = await runOnboarding(
      scriptedPrompts('1', 'not-a-url', 'https://backend.example.com', 'k'),
    );
    expect(saved?.backendUrl).toBe('https://backend.example.com');
  });

  it('gives up rather than looping forever on repeated bad input', async () => {
    const saved = await runOnboarding(scriptedPrompts('1', 'bad', 'bad', 'bad'));
    expect(saved).toBeUndefined();
    expect(writeStoredConfigMock).not.toHaveBeenCalled();
  });

  it('keeps the existing value when the user presses enter on a pre-filled field', async () => {
    storedConfig = { backendUrl: 'https://saved.example.com', backendApiKey: 'saved-key' };

    const saved = await runOnboarding(scriptedPrompts('1', '', ''));

    expect(saved?.backendUrl).toBe('https://saved.example.com');
    expect(saved?.backendApiKey).toBe('saved-key');
  });

  it('collects a connection string for local Anthropic mode', async () => {
    const saved = await runOnboarding(
      scriptedPrompts('2', 'sk-ant-test', 'mongodb://localhost:27017/mydb'),
    );

    expect(saved).toMatchObject({
      executionMode: 'local',
      llmProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-test',
      mongodbUri: 'mongodb://localhost:27017/mydb',
    });
  });

  it('rejects a connection string that is not a mongodb URI', async () => {
    const saved = await runOnboarding(
      scriptedPrompts('2', 'sk-ant-test', 'https://wrong', 'mongodb+srv://a:b@c.net/db'),
    );
    expect(saved?.mongodbUri).toBe('mongodb+srv://a:b@c.net/db');
  });

  it('uses the default Ollama URL when the user presses enter', async () => {
    const saved = await runOnboarding(scriptedPrompts('3', '', 'mongodb://localhost:27017/mydb'));

    expect(saved).toMatchObject({
      executionMode: 'local',
      llmProvider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
    });
  });

  it('saves nothing when the choice is not recognised', async () => {
    const saved = await runOnboarding(scriptedPrompts('9'));
    expect(saved).toBeUndefined();
    expect(writeStoredConfigMock).not.toHaveBeenCalled();
  });

  describe('with a backend URL baked in by a distribution', () => {
    it('accepts it on enter, so an operator only supplies an access key', async () => {
      process.env.MONGOSH_LLM_DEFAULT_BACKEND_URL = 'https://baked.example.com';

      const saved = await runOnboarding(scriptedPrompts('1', '', 'ops-key'));

      expect(saved?.backendUrl).toBe('https://baked.example.com');
      expect(saved?.backendApiKey).toBe('ops-key');
    });

    it('still lets the operator type a different URL', async () => {
      process.env.MONGOSH_LLM_DEFAULT_BACKEND_URL = 'https://baked.example.com';

      const saved = await runOnboarding(scriptedPrompts('1', 'https://other.example.com', 'k'));

      expect(saved?.backendUrl).toBe('https://other.example.com');
    });

    it('prefers a previously saved URL, so re-running setup does not silently revert it', async () => {
      process.env.MONGOSH_LLM_DEFAULT_BACKEND_URL = 'https://baked.example.com';
      storedConfig = { backendUrl: 'https://saved.example.com' };

      const saved = await runOnboarding(scriptedPrompts('1', '', 'k'));

      expect(saved?.backendUrl).toBe('https://saved.example.com');
    });
  });

  it('always starts in safe mode, so a new operator cannot accidentally write', async () => {
    const saved = await runOnboarding(scriptedPrompts('1', 'https://b.example', 'k'));
    expect(saved?.queryMode).toBe('safe');
  });
});
