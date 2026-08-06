import { Command } from 'commander';
import type { QueryMode } from '@emrah.su/mongosh-llm-shared';
import { ConfigNotFoundError, loadConfig } from './config.js';
import { runOnboarding } from './onboarding.js';
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
  .argument('[command]', 'Optional subcommand: "setup" to re-run first-time configuration')
  .option('--safe', 'Read-only mode (default)')
  .option('--unsafe', 'Allow write operations (asks for confirmation)')
  .option('--exec <query>', 'Execute a single mongosh command directly and exit')
  .version('0.3.0');

program.parse(process.argv);
const options = program.opts<CliOptions>();
const [subcommand] = program.args;

async function main(): Promise<void> {
  const queryMode: QueryMode | undefined = options.unsafe ? 'unsafe' : options.safe ? 'safe' : undefined;

  if (subcommand === 'setup') {
    const saved = await runOnboarding();
    if (!saved) {
      process.exitCode = 1;
    }
    return;
  }

  let config;
  try {
    config = loadConfig({ queryMode });
  } catch (error) {
    // Nothing configured yet - walk the user through it rather than printing a validation error.
    if (!(error instanceof ConfigNotFoundError)) {
      throw error;
    }
    if (!(await runOnboarding())) {
      process.exitCode = 1;
      return;
    }
    config = loadConfig({ queryMode });
  }

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
