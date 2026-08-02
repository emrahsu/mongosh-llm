import chalk from 'chalk';

const PAGE_SIZE_LINES = 100;

export function printBanner(): void {
  console.log(
    chalk.cyanBright('mongosh-llm') + chalk.gray(' - ask your database questions in plain English'),
  );
}

export function printToolUse(query: string): void {
  console.log(chalk.gray(`  [tool] inspecting: ${query}`));
}

export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.gray(message));
}

/** Prints long output page by page, letting the user step through or bail out early. */
export async function printPaginated(
  text: string,
  ask: (prompt: string) => Promise<string>,
): Promise<void> {
  const lines = text.split('\n');
  if (lines.length <= PAGE_SIZE_LINES) {
    console.log(text);
    return;
  }

  for (let i = 0; i < lines.length; i += PAGE_SIZE_LINES) {
    console.log(lines.slice(i, i + PAGE_SIZE_LINES).join('\n'));
    const isLastPage = i + PAGE_SIZE_LINES >= lines.length;
    if (isLastPage) {
      break;
    }
    try {
      const input = await ask(chalk.gray('-- more (Enter to continue, q to stop) --'));
      if (input.trim().toLowerCase() === 'q') {
        break;
      }
    } catch {
      break; // stdin closed mid-pagination - stop here
    }
  }
}
