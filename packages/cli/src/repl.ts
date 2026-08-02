import { createInterface } from 'node:readline/promises';
import chalk from 'chalk';
import type { AppConfig } from '@emrahsu/mongosh-llm-shared';
import { AnthropicLlmService } from './llm/anthropic-client.js';
import { ConversationHistory } from './conversation.js';
import { executeCommand, fetchSchema, MongoshNotFoundError } from './mongosh/client.js';
import { validateQuery } from './validation.js';
import { confirmWriteOperation } from './prompt.js';
import { printBanner, printError, printInfo, printPaginated } from './display.js';

type Ask = (prompt: string) => Promise<string>;

/** Runs a single mongosh command directly (used by --exec), applying the same safety checks as the REPL. */
export async function runCommandOnce(command: string, config: AppConfig): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = (prompt) => rl.question(prompt);
  try {
    await executeAndDisplay(command, config, ask);
  } finally {
    rl.close();
  }
}

export async function startRepl(config: AppConfig): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = (prompt) => rl.question(prompt);

  printBanner();
  printInfo(`Mode: ${config.queryMode}. Type "exit" to quit, "--clear" to reset conversation.\n`);

  if (!config.anthropicApiKey) {
    printError('Backend mode is not implemented yet in this build - set ANTHROPIC_API_KEY.');
    rl.close();
    return;
  }

  const llm = new AnthropicLlmService(config.anthropicApiKey, config.anthropicModel, config.mongodbUri);
  const history = new ConversationHistory();

  let schema = '';
  try {
    schema = await fetchSchema(config.mongodbUri);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
  }

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
      await executeAndDisplay(input.slice('--exec '.length).trim(), config, ask);
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

      await executeAndDisplay(response.content, config, ask, history);
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
    const result = await executeCommand(config.mongodbUri, command);
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
