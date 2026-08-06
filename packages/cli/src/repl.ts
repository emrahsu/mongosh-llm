import { createInterface } from 'node:readline/promises';
import chalk from 'chalk';
import { validateQuery, type AppConfig } from '@emrah.su/mongosh-llm-shared';
import { createLlmClient } from './llm/factory.js';
import { ToolUseOrchestrator } from './llm/tool-use-orchestrator.js';
import { ConversationHistory } from './conversation.js';
import { createQueryExecutor } from './executor/factory.js';
import type { QueryExecutor } from './executor/types.js';
import { MongoshNotFoundError } from './mongosh/client.js';
import { confirmWriteOperation } from './prompt.js';
import { printBanner, printError, printInfo, printPaginated } from './display.js';

function describeProvider(config: AppConfig): string {
  if (config.llmProvider) {
    return config.llmProvider;
  }
  if (config.anthropicApiKey) {
    return 'anthropic';
  }
  if (config.backendUrl) {
    return 'backend';
  }
  return 'ollama';
}

type Ask = (prompt: string) => Promise<string>;

/** Runs a single mongosh command directly (used by --exec), applying the same safety checks as the REPL. */
export async function runCommandOnce(
  command: string,
  config: AppConfig,
  executor: QueryExecutor = createQueryExecutor(config),
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = (prompt) => rl.question(prompt);
  try {
    await executeAndDisplay(command, config, executor, ask);
  } finally {
    rl.close();
  }
}

export async function startRepl(
  config: AppConfig,
  executor: QueryExecutor = createQueryExecutor(config),
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = (prompt) => rl.question(prompt);

  const mode = describeProvider(config);
  printBanner(mode, config.queryMode);

  const history = new ConversationHistory();

  // Both of these can fail if the database is unreachable; neither is fatal to the REPL itself, so
  // report and carry on with a degraded prompt rather than refusing to start.
  let currentDatabase: string | undefined;
  let schema = '';
  try {
    currentDatabase = await executor.getDatabaseName();
    schema = await executor.fetchSchema();
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
  }

  const llm = new ToolUseOrchestrator(createLlmClient(config), executor, currentDatabase);

  for (;;) {
    let input: string;
    try {
      input = (await ask(chalk.green('\n> '))).trim();
    } catch {
      break; // stdin closed (EOF / Ctrl+D) - exit gracefully
    }

    if (input === 'exit' || input === 'quit') {
      break;
    }
    if (input === '--clear') {
      history.clear();
      printInfo('Conversation history cleared.');
      continue;
    }
    if (input === '--help' || input === '-h') {
      printHelp();
      continue;
    }
    if (input.startsWith('--exec ')) {
      await executeAndDisplay(input.slice('--exec '.length).trim(), config, executor, ask);
      continue;
    }
    if (!input) {
      continue;
    }

    try {
      const response = await llm.ask(history.getAll(), input, schema, config.queryMode);
      history.push({ role: 'user', content: input });

      if (response.type === 'text') {
        console.log(response.content);
        history.push({ role: 'assistant', content: response.content });
        continue;
      }

      await executeAndDisplay(response.content, config, executor, ask, history);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
    }
  }

  rl.close();
}

/** Validates, optionally confirms, executes via mongosh, and records the result in history. */
async function executeAndDisplay(
  command: string,
  config: AppConfig,
  executor: QueryExecutor,
  ask: Ask,
  history?: ConversationHistory,
): Promise<void> {
  const validation = validateQuery(command, config.queryMode);
  if (!validation.allowed) {
    printError(validation.reason ?? 'This command is not allowed.');
    return;
  }
  if (validation.reason && !(await confirmWriteOperation(command, ask))) {
    printInfo('Cancelled.');
    return;
  }

  try {
    const result = await executor.executeCommand(command);
    await printPaginated(result, ask);
    history?.push({ role: 'assistant', content: `Command result: ${truncateForHistory(result)}` });
  } catch (error) {
    const message =
      error instanceof MongoshNotFoundError
        ? error.message
        : `Error: ${error instanceof Error ? error.message : String(error)}`;
    printError(message);
    history?.push({ role: 'assistant', content: message });
  }
}

function truncateForHistory(text: string, maxLength = 2000): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}... (truncated)` : text;
}

function printHelp(): void {
  console.log(`
Commands:
  <question>        Ask a natural language question about your data
  --exec <query>     Run a mongosh command directly, skipping the LLM
  --clear            Clear conversation history
  exit / quit        Exit
`);
}
