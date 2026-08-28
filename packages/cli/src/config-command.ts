import chalk from 'chalk';
import type { LlmProvider } from '@emrah.su/mongosh-llm-shared';
import { ConfigNotFoundError, loadConfig } from './config.js';
import { readStoredConfig, writeStoredConfig, type StoredConfig } from './config-store.js';
import { resolveProvider } from './llm/factory.js';
import { printError } from './display.js';
import { createPrompts, setupAnthropic, setupBackend, setupOllama, type Prompts } from './onboarding.js';

const MONGO_GREEN = chalk.hex('#00ED64');

interface ProviderOption {
  provider: LlmProvider;
  label: string;
  setup: (prompts: Prompts, existing: StoredConfig) => Promise<StoredConfig | undefined>;
}

/** Numbering is fixed and user-facing (--setConfig 1|2|3), independent of the LlmProvider enum's order. */
const PROVIDER_MENU: Record<string, ProviderOption> = {
  '1': { provider: 'ollama', label: 'Ollama', setup: setupOllama },
  '2': { provider: 'backend', label: 'Self Hosted Backend', setup: setupBackend },
  '3': { provider: 'anthropic', label: 'Anthropic Key', setup: setupAnthropic },
};

/** Prints all three options with the currently active one highlighted. */
export function printActiveConfig(): void {
  let active: LlmProvider | undefined;
  try {
    active = resolveProvider(loadConfig());
  } catch (error) {
    if (!(error instanceof ConfigNotFoundError)) {
      throw error;
    }
  }

  console.log('');
  console.log(chalk.gray('  Current LLM provider:'));
  for (const [key, option] of Object.entries(PROVIDER_MENU)) {
    const isActive = option.provider === active;
    const marker = isActive ? MONGO_GREEN('●') : chalk.gray('○');
    const label = `${key}. ${option.label}`;
    console.log(`  ${marker} ${isActive ? MONGO_GREEN.bold(label) : chalk.gray(label)}`);
  }
  if (!active) {
    console.log(chalk.yellow('\n  Nothing configured yet. Run "mongosh-llm setup" or "mongosh-llm --setConfig <1|2|3>".'));
  }
  console.log('');
}

/**
 * Switches the active provider by number, asking for whatever that provider still needs (e.g. a
 * backend URL and access key) and persisting the result to the stored config file. Reuses the
 * exact same setup* functions as first-run onboarding, so the questions asked never drift apart.
 * `prompts` lets a caller that already owns a readline interface (the REPL) share it instead of
 * opening a second one on the same stdin; when omitted, a fresh one is created and closed here.
 */
export async function setActiveConfig(choice: string, prompts?: Prompts): Promise<boolean> {
  const option = PROVIDER_MENU[choice];
  if (!option) {
    printError(`"${choice}" isn't a valid option. Use 1 (Ollama), 2 (Self Hosted Backend), or 3 (Anthropic Key).`);
    return false;
  }

  const ownPrompts = prompts ?? createPrompts();
  let config: StoredConfig | undefined;
  try {
    config = await option.setup(ownPrompts, readStoredConfig());
  } finally {
    if (!prompts) {
      ownPrompts.close();
    }
  }

  if (!config) {
    return false;
  }

  writeStoredConfig(config);
  console.log(MONGO_GREEN(`\n  Switched to ${option.label}.\n`));
  return true;
}
