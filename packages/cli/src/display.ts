import chalk from 'chalk';
import type { QueryMode, ToolExecutionResult } from '@emrahsu/mongosh-llm-shared';

const PAGE_SIZE_LINES = 100;
const BOX_WIDTH = 54;
const MONGO_GREEN = chalk.hex('#00ED64');

interface Segment {
  text: string;
  color?: (s: string) => string;
}

/** Renders one boxed line from plain-text segments, padding based on visible (uncolored) length. */
function boxLine(segments: Segment[]): string {
  const plainLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
  const padding = ' '.repeat(Math.max(0, BOX_WIDTH - plainLength));
  const rendered = segments.map((seg) => (seg.color ? seg.color(seg.text) : seg.text)).join('');
  return `${chalk.gray('│')} ${rendered}${padding} ${chalk.gray('│')}`;
}

export function printBanner(mode: string, queryMode: QueryMode): void {
  const safetyColor = queryMode === 'safe' ? chalk.green : chalk.yellow;

  console.log(chalk.gray(`┌${'─'.repeat(BOX_WIDTH + 2)}┐`));
  console.log(boxLine([{ text: '🍃 ' }, { text: 'mongosh-llm', color: (s) => MONGO_GREEN.bold(s) }]));
  console.log(boxLine([{ text: '   Ask your database questions in plain English' }]));
  console.log(boxLine([{ text: '' }]));
  console.log(
    boxLine([
      { text: '   mode: ' },
      { text: mode, color: (s) => MONGO_GREEN(s) },
      { text: '   safety: ' },
      { text: queryMode, color: safetyColor },
    ]),
  );
  console.log(boxLine([{ text: '   type "exit" to quit, "--clear" to reset conversation' }]));
  console.log(chalk.gray(`└${'─'.repeat(BOX_WIDTH + 2)}┘`));
}

/** Shows a tool-use query before it runs, dimmed so it doesn't compete with the actual answer. */
export function printToolUse(query: string, cached: boolean): void {
  const cacheIndicator = cached ? ' [cached]' : '';
  console.log(chalk.gray(`  🔍 ${query}${cacheIndicator}`));
}

/** Shows a one-line summary of what a tool call returned, mirroring the query's dimmed style. */
export function printToolResult(result: ToolExecutionResult): void {
  if (!result.success) {
    const errorMessage = (result.error ?? 'Unknown error').slice(0, 60);
    console.log(chalk.gray(`  ✗ Error: ${errorMessage}`));
    return;
  }

  const truncationWarning = result.truncated ? chalk.yellow(' ⚠ Truncated to limit') : '';
  console.log(chalk.gray(`  ${summarizeToolData(result.data)}`) + truncationWarning);
}

function summarizeToolData(data: unknown): string {
  if (Array.isArray(data)) {
    return `✓ Returned ${data.length} item${data.length === 1 ? '' : 's'}`;
  }
  if (data !== null && typeof data === 'object') {
    const fieldCount = Object.keys(data).length;
    return `✓ Returned object with ${fieldCount} field${fieldCount === 1 ? '' : 's'}`;
  }
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) {
      return '✓ Completed';
    }
    return `✓ ${data.length > 50 ? data.slice(0, 50) : data}`;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return `✓ ${data}`;
  }
  return '✓ null';
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
