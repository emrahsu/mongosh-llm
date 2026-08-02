import chalk from 'chalk';

/** Asks the user to explicitly confirm before running a write operation in unsafe mode. */
export async function confirmWriteOperation(
  command: string,
  ask: (prompt: string) => Promise<string>,
): Promise<boolean> {
  console.log(chalk.yellow('\nThis command will modify data:'));
  console.log(chalk.white(command));
  try {
    const answer = await ask(chalk.yellow('Run it? (y/N) '));
    return answer.trim().toLowerCase() === 'y';
  } catch {
    return false; // stdin closed mid-prompt - fail safe and deny the write
  }
}
