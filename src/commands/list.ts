/** `leetcode list` — browse and filter problems. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import type { DifficultyFilter, StatusFilter } from '../api/client.js';
import { UsageError } from '../lib/errors.js';
import { difficulty as fmtDiff, statusIcon, paidIcon, padStart, acceptance, chalk } from '../lib/format.js';

export function parseDifficulty(d?: string): DifficultyFilter | undefined {
  if (!d) return undefined;
  const up = d.toUpperCase();
  if (up === 'EASY' || up === 'MEDIUM' || up === 'HARD') return up;
  throw new UsageError(`Invalid difficulty "${d}".`, 'Use easy, medium, or hard.');
}

// Friendly status names → LeetCode's filter enum.
const STATUS_MAP: Record<string, StatusFilter> = {
  unsolved: 'NOT_STARTED',
  todo: 'NOT_STARTED',
  'not-started': 'NOT_STARTED',
  new: 'NOT_STARTED',
  solved: 'AC',
  ac: 'AC',
  done: 'AC',
  attempted: 'TRIED',
  tried: 'TRIED',
};

export function parseStatus(s?: string): StatusFilter | undefined {
  if (!s) return undefined;
  const v = STATUS_MAP[s.toLowerCase()];
  if (!v) throw new UsageError(`Invalid status "${s}".`, 'Use unsolved, solved, or attempted.');
  return v;
}

interface ListOpts {
  difficulty?: string;
  tag?: string[];
  search?: string;
  category?: string;
  status?: string;
  limit: string;
  page: string;
}

export function registerList(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List problems with optional filters')
    .option('-d, --difficulty <level>', 'easy | medium | hard')
    .option('-t, --tag <tag...>', 'filter by topic-tag slug(s)')
    .option('-s, --search <keywords>', 'search by keyword')
    .option('-c, --category <slug>', 'category slug (e.g. algorithms, database)')
    .option('--status <state>', 'unsolved | solved | attempted (requires login)')
    .option('-n, --limit <n>', 'number of problems to show', '50')
    .option('-p, --page <n>', 'page number (1-based)', '1')
    .action(async (opts: ListOpts) => {
      const limit = Math.max(1, Number.parseInt(opts.limit, 10) || 50);
      const page = Math.max(1, Number.parseInt(opts.page, 10) || 1);
      const client = new LeetCodeClient(config);
      const { total, items } = await client.problemList({
        difficulty: parseDifficulty(opts.difficulty),
        tags: opts.tag,
        search: opts.search,
        category: opts.category,
        status: parseStatus(opts.status),
        limit,
        skip: (page - 1) * limit,
      });

      if (items.length === 0) {
        console.log('No problems found.');
        return;
      }

      const idWidth = Math.max(2, ...items.map((i) => i.frontendId.length));
      for (const it of items) {
        const id = chalk.dim(padStart(it.frontendId, idWidth));
        const ac = chalk.dim(padStart(it.acRate != null ? acceptance(it.acRate) : '-', 6));
        const diffCell = fmtDiff(it.difficulty) + ' '.repeat(Math.max(0, 6 - it.difficulty.length));
        console.log(`${statusIcon(it.status)} ${paidIcon(it.paidOnly)} ${id}  ${diffCell}  ${ac}  ${it.title}`);
      }
      console.log(chalk.dim(`\nShowing ${items.length} of ${total} (page ${page}).`));
    });
}
