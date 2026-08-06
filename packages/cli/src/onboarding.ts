import { createInterface } from 'node:readline/promises';
import chalk from 'chalk';
import { DEFAULT_OLLAMA_BASE_URL } from '@emrah.su/mongosh-llm-shared';
import { getConfigPath, readStoredConfig, writeStoredConfig, type StoredConfig } from './config-store.js';

const MONGO_GREEN = chalk.hex('#00ED64');

/** Injected so tests can drive the wizard without a TTY. */
export interface Prompts {
  ask(question: string): Promise<string>;
  close(): void;
}

function createPrompts(): Prompts {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (question) => rl.question(question),
    close: () => rl.close(),
  };
}

/**
 * First-run setup. Asks the minimum needed to get working, defaulting to the company-backend path
 * so an operator never has to know what a connection string is.
 *
 * Returns the saved config, or undefined if the user abandoned setup.
 */
export async function runOnboarding(prompts: Prompts = createPrompts()): Promise<StoredConfig | undefined> {
  const existing = readStoredConfig();
  try {
    console.log('');
    console.log(MONGO_GREEN.bold('  Welcome to mongosh-llm'));
    console.log(chalk.gray("  Let's get you set up - this only takes a moment.\n"));
    console.log('  How will you connect?');
    console.log(`    ${MONGO_GREEN('1')}  Company backend  ${chalk.gray('(recommended - your admin gave you a URL and access key)')}`);
    console.log(`    ${MONGO_GREEN('2')}  My own Anthropic API key  ${chalk.gray('(you also need a MongoDB connection string)')}`);
    console.log(`    ${MONGO_GREEN('3')}  Local model via Ollama  ${chalk.gray('(you also need a MongoDB connection string)')}`);
    console.log('');

    const choice = (await prompts.ask(chalk.green('  Choice [1] > '))).trim() || '1';

    let config: StoredConfig | undefined;
    if (choice === '1') {
      config = await setupBackend(prompts, existing);
    } else if (choice === '2') {
      config = await setupAnthropic(prompts, existing);
    } else if (choice === '3') {
      config = await setupOllama(prompts, existing);
    } else {
      console.log(chalk.red(`\n  "${choice}" isn't one of the options. Run setup again to retry.`));
      return undefined;
    }

    if (!config) {
      return undefined;
    }

    writeStoredConfig(config);
    console.log(chalk.gray(`\n  Saved to ${getConfigPath()}`));
    console.log(chalk.gray('  Run "mongosh-llm setup" any time to change these settings.\n'));
    return config;
  } finally {
    prompts.close();
  }
}

async function setupBackend(prompts: Prompts, existing: StoredConfig): Promise<StoredConfig | undefined> {
  // A distribution can bake in its own backend URL so operators only supply an access key. Kept
  // separate from BACKEND_URL (which loadConfig reads) so a baked-in default can't make config look
  // complete when the access key is still missing - that would skip setup and 401 on first query.
  const defaultUrl = process.env.MONGOSH_LLM_DEFAULT_BACKEND_URL?.trim() || undefined;

  console.log(
    chalk.gray(
      defaultUrl
        ? '\n  Your admin will have given you an access key.\n'
        : '\n  Your admin will have given you these two values.\n',
    ),
  );

  const url = await askRequired(
    prompts,
    '  Backend URL',
    existing.backendUrl ?? defaultUrl,
    (value) => (isHttpUrl(value) ? undefined : 'Please enter a full URL, e.g. https://example.com'),
  );
  if (!url) {
    return undefined;
  }

  const key = await askRequired(prompts, '  Access key', existing.backendApiKey, () => undefined, true);
  if (!key) {
    return undefined;
  }

  // Nothing else to ask: the backend holds the connection string, which is the entire point.
  return {
    executionMode: 'backend',
    llmProvider: 'backend',
    backendUrl: stripTrailingSlash(url),
    backendApiKey: key,
    queryMode: 'safe',
  };
}

async function setupAnthropic(prompts: Prompts, existing: StoredConfig): Promise<StoredConfig | undefined> {
  const key = await askRequired(prompts, '\n  Anthropic API key', existing.anthropicApiKey, () => undefined, true);
  if (!key) {
    return undefined;
  }
  const uri = await askMongoUri(prompts, existing);
  if (!uri) {
    return undefined;
  }
  return { executionMode: 'local', llmProvider: 'anthropic', anthropicApiKey: key, mongodbUri: uri, queryMode: 'safe' };
}

async function setupOllama(prompts: Prompts, existing: StoredConfig): Promise<StoredConfig | undefined> {
  const url =
    (await prompts.ask(chalk.green(`\n  Ollama URL [${existing.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL}] > `))).trim() ||
    existing.ollamaBaseUrl ||
    DEFAULT_OLLAMA_BASE_URL;
  const uri = await askMongoUri(prompts, existing);
  if (!uri) {
    return undefined;
  }
  return { executionMode: 'local', llmProvider: 'ollama', ollamaBaseUrl: stripTrailingSlash(url), mongodbUri: uri, queryMode: 'safe' };
}

async function askMongoUri(prompts: Prompts, existing: StoredConfig): Promise<string | undefined> {
  console.log(chalk.gray('\n  This mode runs queries on your own machine, so it needs a MongoDB'));
  console.log(chalk.gray('  connection string and mongosh installed locally.'));
  return askRequired(prompts, '  MongoDB connection string', existing.mongodbUri, (value) =>
    value.startsWith('mongodb://') || value.startsWith('mongodb+srv://')
      ? undefined
      : 'Should start with mongodb:// or mongodb+srv://',
  );
}

/**
 * Asks until a valid non-empty answer arrives, or the user gives up. Accepting the existing value on
 * an empty answer makes re-running setup to change one field painless.
 */
async function askRequired(
  prompts: Prompts,
  label: string,
  existing: string | undefined,
  validate: (value: string) => string | undefined,
  secret = false,
): Promise<string | undefined> {
  const suffix = existing ? chalk.gray(secret ? ' [keep current]' : ` [${existing}]`) : '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = (await prompts.ask(chalk.green(`${label}${suffix} > `))).trim();
    const value = answer || existing;
    if (!value) {
      console.log(chalk.red('  This one is required.'));
      continue;
    }
    const problem = validate(value);
    if (problem) {
      console.log(chalk.red(`  ${problem}`));
      continue;
    }
    return value;
  }
  console.log(chalk.red('\n  Giving up after 3 tries. Run "mongosh-llm setup" to start over.'));
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
