import { Command } from 'commander';
import type { QueryMode } from '@emrah.su/mongosh-llm-shared';
import { loadConfig } from './config.js';
import { runCommandOnce, startRepl } from './repl.js';
import { printError } from './display.js';

interface CliOptions {
  safe?: boolean;
  unsafe?: boolean;
  exec?: string;
}

const program = new Command();

program
  .name('mongosh-llm')
  .description('Query MongoDB in plain English, powered by Claude')
  .option('--safe', 'Read-only mode (default)')
  .option('--unsafe', 'Allow write operations (asks for confirmation)')
  .option('--exec <query>', 'Execute a single mongosh command directly and exit')
  .version('0.1.0');

program.parse(process.argv);
const options = program.opts<CliOptions>();

async function main(): Promise<void> {
  const queryMode: QueryMode | undefined = options.unsafe ? 'unsafe' : options.safe ? 'safe' : undefined;
  const config = loadConfig({ queryMode });

  if (options.exec) {
    await runCommandOnce(options.exec, config);
    return;
  }

  await startRepl(config);
}

main().catch((error) => {
  printError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
