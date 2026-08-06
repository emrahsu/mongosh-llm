import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Persisted settings. Deliberately a subset of AppConfig: only what an operator would be asked
 * during onboarding, never anything derived.
 */
export interface StoredConfig {
  executionMode?: 'local' | 'backend';
  llmProvider?: 'anthropic' | 'backend' | 'ollama';
  mongodbUri?: string;
  backendUrl?: string;
  backendApiKey?: string;
  anthropicApiKey?: string;
  ollamaBaseUrl?: string;
  queryMode?: 'safe' | 'unsafe';
}

/**
 * Per-user config location. Unlike a `.env` in the working directory, this works no matter which
 * folder the CLI is launched from - the deciding factor for non-technical operators who double-click
 * an executable rather than cd-ing anywhere.
 */
export function getConfigPath(): string {
  if (platform() === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'mongosh-llm', 'config.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdg, 'mongosh-llm', 'config.json');
}

/** Reads stored config, returning {} when absent or unreadable - a corrupt file must not be fatal. */
export function readStoredConfig(path = getConfigPath()): StoredConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? (parsed as StoredConfig) : {};
  } catch {
    return {};
  }
}

/** Writes config with owner-only permissions, since it may hold an API key. */
export function writeStoredConfig(config: StoredConfig, path = getConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    // writeFileSync's mode is ignored when the file already exists, so enforce it explicitly.
    chmodSync(path, 0o600);
  } catch {
    // Best-effort: some Windows filesystems don't support POSIX modes.
  }
}
