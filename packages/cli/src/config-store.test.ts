import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { getConfigPath, readStoredConfig, writeStoredConfig } from './config-store.js';

const dirs: string[] = [];

function tempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mongosh-llm-cfg-'));
  dirs.push(dir);
  return join(dir, 'nested', 'config.json');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('getConfigPath', () => {
  it('points at a per-user directory, not the working directory', () => {
    const path = getConfigPath();
    expect(path).toMatch(/mongosh-llm/);
    expect(path).toMatch(/config\.json$/);
    // A relative path would reintroduce the cwd-dependence this file exists to avoid.
    expect(path.startsWith('.')).toBe(false);
  });
});

describe('readStoredConfig', () => {
  it('returns an empty object when the file does not exist', () => {
    expect(readStoredConfig(tempConfigPath())).toEqual({});
  });

  it('returns an empty object rather than throwing on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mongosh-llm-cfg-'));
    dirs.push(dir);
    const path = join(dir, 'config.json');
    writeFileSync(path, '{ not valid json');
    expect(readStoredConfig(path)).toEqual({});
  });
});

describe('writeStoredConfig', () => {
  it('creates missing parent directories and round-trips the config', () => {
    const path = tempConfigPath();
    writeStoredConfig({ executionMode: 'backend', backendUrl: 'https://x.example' }, path);
    expect(readStoredConfig(path)).toEqual({
      executionMode: 'backend',
      backendUrl: 'https://x.example',
    });
  });

  it('writes owner-only permissions since the file can hold an API key', () => {
    const path = tempConfigPath();
    writeStoredConfig({ backendApiKey: 'secret' }, path);
    if (platform() !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
    }
  });

  it('overwrites an existing file rather than merging into it', () => {
    const path = tempConfigPath();
    writeStoredConfig({ backendUrl: 'https://old.example', backendApiKey: 'k' }, path);
    writeStoredConfig({ backendUrl: 'https://new.example' }, path);
    expect(readStoredConfig(path)).toEqual({ backendUrl: 'https://new.example' });
  });
});
