/** `leetcode hint <id>` — show a problem's hints. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { UsageError } from '../lib/errors.js';
import { renderHtml } from '../lib/render.js';
import { chalk } from '../lib/format.js';

export function registerHint(program: Command): void {
  program
    .command('hint')
    .description("Show a problem's hints")
    .argument('<id>', 'problem id or slug')
    .option('-n, --number <k>', 'show only the k-th hint')
    .action(async (id: string, opts: { number?: string }) => {
      const client = new LeetCodeClient(config);
      const slug = await client.resolveSlug(id);
      const q = await client.questionDetail(slug);
      const hints = q.hints ?? [];

      if (hints.length === 0) {
        console.log('No hints available for this problem.');
        return;
      }

      if (opts.number !== undefined) {
        const k = Number.parseInt(opts.number, 10);
        if (!k || k < 1 || k > hints.length) {
          throw new UsageError(`Hint ${opts.number} is out of range (1..${hints.length}).`);
        }
        console.log(`${chalk.yellow(`${k}.`)} ${renderHtml(hints[k - 1] ?? '')}`);
        return;
      }

      hints.forEach((h, i) => console.log(`${chalk.yellow(`${i + 1}.`)} ${renderHtml(h)}\n`));
    });
}
