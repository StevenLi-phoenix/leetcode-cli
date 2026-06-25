/**
 * Presentation helpers: colours, icons, padding, and table formatting.
 *
 * Everything visual lives here so commands stay focused on logic and the
 * look-and-feel is consistent across the CLI.
 */
import chalk from 'chalk';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** Colour a difficulty label (green / yellow / red). */
export function difficulty(d: string): string {
  switch (d.toLowerCase()) {
    case 'easy':
      return chalk.green(d);
    case 'medium':
      return chalk.yellow(d);
    case 'hard':
      return chalk.red(d);
    default:
      return d;
  }
}

/**
 * Status icon for a problem-list row.
 * LeetCode reports per-user status as 'ac' (solved), 'notac' (attempted), or null.
 */
export function statusIcon(status: string | null | undefined): string {
  switch (status) {
    case 'ac':
    case 'AC':
    case 'Accepted':
      return chalk.green('✔');
    case 'notac':
    case 'TRIED':
      return chalk.yellow('✖');
    default:
      return ' ';
  }
}

/** Lock icon for premium-only problems. */
export function paidIcon(isPaid: boolean): string {
  return isPaid ? chalk.yellow('🔒') : ' ';
}

/** Left-pad a plain (ANSI-free) string to a visible width. */
export function padStart(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/** Colour a submission verdict by its status message. */
export function verdict(statusMsg: string): string {
  if (statusMsg === 'Accepted') return chalk.bgGreen.black(` ${statusMsg} `);
  return chalk.bgRed.white(` ${statusMsg} `);
}

/** Format an acceptance rate (0..100) with one decimal. */
export function acceptance(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/** A dim separator line of the given width. */
export function rule(width = 60): string {
  return chalk.dim('─'.repeat(width));
}

/** Section heading used by `show`, `daily`, etc. */
export function heading(text: string): string {
  return chalk.bold.cyan(text);
}

export { chalk };
