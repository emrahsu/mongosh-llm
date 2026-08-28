import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Same rationale as config.test.ts / onboarding.test.ts: keep these tests off the developer's real
// per-user config file.
let stored: Record<string, unknown> = {};
const writeStoredConfig = vi.fn((config: Record<string, unknown>) => {
  stored = config;
});

vi.mock('./config-store.js', () => ({
  readStoredConfig: () => stored,
  writeStoredConfig: (config: Record<string, unknown>) => writeStoredConfig(config),
  getConfigPath: () => '/tmp/mongosh-llm-test/config.json',
}));

const { printActiveConfig, setActiveConfig } = await import('./config-command.js');

/** Feeds scripted answers to a setup wizard in order, as if typed at the prompt. */
function scriptedPrompts(...answers: string[]) {
  const queue = [...answers];
  return {
    ask: async () => queue.shift() ?? '',
    close: () => undefined,
  };
}

const ENV_KEYS = [
  'MONGODB_URI',
  'EXECUTION_MODE',
  'LLM_PROVIDER',
  'ANTHROPIC_API_KEY',
  'BACKEND_URL',
  'OLLAMA_BASE_URL',
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  stored = {};
  writeStoredConfig.mockClear();
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
  vi.restoreAllMocks();
});

describe('setActiveConfig', () => {
  it('rejects a choice outside 1-3 without prompting or touching stored config', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await setActiveConfig('9')).toBe(false);
    expect(writeStoredConfig).not.toHaveBeenCalled();
  });

  it('asks for a MongoDB URI and saves Ollama mode with the default URL on enter', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const ok = await setActiveConfig('1', scriptedPrompts('', 'mongodb://localhost:27017/mydb'));

    expect(ok).toBe(true);
    expect(stored).toMatchObject({
      llmProvider: 'ollama',
      executionMode: 'local',
      ollamaBaseUrl: 'http://localhost:11434',
      mongodbUri: 'mongodb://localhost:27017/mydb',
    });
  });

  it('asks for a backend URL and access key, and needs no MongoDB URI', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const ok = await setActiveConfig('2', scriptedPrompts('https://backend.example.com', 'ops-key'));

    expect(ok).toBe(true);
    expect(stored).toMatchObject({
      llmProvider: 'backend',
      executionMode: 'backend',
      backendUrl: 'https://backend.example.com',
      backendApiKey: 'ops-key',
    });
    expect(stored).not.toHaveProperty('mongodbUri');
  });

  it('asks for an Anthropic API key and a MongoDB URI', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const ok = await setActiveConfig('3', scriptedPrompts('sk-ant-test', 'mongodb://localhost:27017/mydb'));

    expect(ok).toBe(true);
    expect(stored).toMatchObject({
      llmProvider: 'anthropic',
      executionMode: 'local',
      anthropicApiKey: 'sk-ant-test',
      mongodbUri: 'mongodb://localhost:27017/mydb',
    });
  });

  it('keeps a previously saved key when the user presses enter on a pre-filled field', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stored = { backendUrl: 'https://saved.example.com', backendApiKey: 'saved-key' };

    await setActiveConfig('2', scriptedPrompts('', ''));

    expect(stored).toMatchObject({ backendUrl: 'https://saved.example.com', backendApiKey: 'saved-key' });
  });

  it('does not save anything when the user gives up on repeated bad input', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const ok = await setActiveConfig('2', scriptedPrompts('bad', 'bad', 'bad'));

    expect(ok).toBe(false);
    expect(writeStoredConfig).not.toHaveBeenCalled();
  });
});

describe('printActiveConfig', () => {
  it('marks the provider resolved from env/stored config as active', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });

    printActiveConfig();
    const output = logs.join('\n');

    expect(output).toContain('Anthropic Key');
    expect(output).not.toContain('Nothing configured yet');
  });

  it('reports nothing configured when no provider is reachable', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });

    printActiveConfig();

    expect(logs.join('\n')).toContain('Nothing configured yet');
  });
});
