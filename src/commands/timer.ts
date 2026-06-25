/**
 * `leetcode timer <id>` — a local interview-style countdown.
 *
 * Counts down from a difficulty-based default (Easy 20m / Medium 40m /
 * Hard 60m, overridable), keeps running into overtime, and on Ctrl-C records
 * the attempt. `--stats` prints the saved history.
 */
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Command } from 'commander';
import { config } from '../config.js';
import type { TimerDefaults } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { UsageError } from '../lib/errors.js';
import { difficulty as fmtDiff, chalk, rule } from '../lib/format.js';

function fmtClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '+' : '';
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  return `${sign}${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Render an updating countdown until the user presses Ctrl-C. */
function runCountdown(plannedSeconds: number, label: string): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tty = Boolean(stdout.isTTY);
    let interval: ReturnType<typeof setInterval> | undefined;

    if (tty) {
      const draw = (): void => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const remaining = plannedSeconds - elapsed;
        const clock = remaining >= 0 ? chalk.cyan(fmtClock(remaining)) : chalk.red(`OVERTIME ${fmtClock(remaining)}`);
        stdout.write(`\r\x1b[K${label}  ${clock}  ${chalk.dim('(Ctrl-C to stop)')}`);
      };
      draw();
      interval = setInterval(draw, 1000);
    } else {
      // No cursor control off a TTY — just announce and wait.
      stdout.write(`${label}  timer running for ${fmtClock(plannedSeconds)} (Ctrl-C to stop)\n`);
    }

    const onSigint = (): void => {
      if (interval) clearInterval(interval);
      process.off('SIGINT', onSigint);
      if (tty) stdout.write('\n');
      resolve(Math.floor((Date.now() - start) / 1000));
    };
    process.on('SIGINT', onSigint);
  });
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

function printStats(): void {
  const history = config.getTimerHistory();
  if (history.length === 0) {
    console.log('No timer history yet.');
    return;
  }
  console.log(chalk.bold('Timer history'));
  console.log(rule());
  for (const r of history) {
    const mark = r.solved ? chalk.green('✔') : chalk.red('✖');
    const when = r.completedAt.slice(0, 10);
    console.log(
      `${mark} ${chalk.dim(when)}  #${r.id} ${r.title}  ` +
        `${chalk.dim('planned')} ${r.plannedMinutes}m ${chalk.dim('actual')} ${fmtClock(r.actualSeconds)}`,
    );
  }
  const solved = history.filter((r) => r.solved).length;
  const avg = Math.round(history.reduce((a, r) => a + r.actualSeconds, 0) / history.length);
  console.log(rule());
  console.log(chalk.dim(`${history.length} attempts · ${solved} solved · avg ${fmtClock(avg)}`));
}

export function registerTimer(program: Command): void {
  program
    .command('timer')
    .description('Interview-style countdown timer for a problem')
    .argument('[id]', 'problem id or slug')
    .option('-m, --minutes <n>', 'override the countdown length (minutes)')
    .option('--stats', 'show timer history instead of starting a timer')
    .action(async (id: string | undefined, opts: { minutes?: string; stats?: boolean }) => {
      if (opts.stats) {
        printStats();
        return;
      }
      if (!id) throw new UsageError('A problem id or slug is required.', 'Or use `leetcode timer --stats`.');

      const client = new LeetCodeClient(config);
      const slug = await client.resolveSlug(id);
      const q = await client.questionDetail(slug);

      const defaults = config.getTimerDefaults();
      const byDifficulty = defaults[q.difficulty as keyof TimerDefaults] ?? 30;
      const minutes = opts.minutes ? Math.max(1, Number.parseInt(opts.minutes, 10) || byDifficulty) : byDifficulty;

      console.log(`${chalk.bold(`#${q.questionFrontendId} ${q.title}`)}  ${fmtDiff(q.difficulty)}`);
      console.log(chalk.dim(`Planned: ${minutes} minutes`));

      const actualSeconds = await runCountdown(minutes * 60, `#${q.questionFrontendId}`);
      const solved = await askYesNo('Solved it? (y/N) ');
      config.addTimerRecord({
        id: q.questionFrontendId,
        slug: q.titleSlug,
        title: q.title,
        difficulty: q.difficulty,
        plannedMinutes: minutes,
        actualSeconds,
        completedAt: new Date().toISOString(),
        solved,
      });
      console.log(chalk.green(`✔ Recorded: ${fmtClock(actualSeconds)} ${solved ? '(solved)' : '(unsolved)'}.`));
    });
}
