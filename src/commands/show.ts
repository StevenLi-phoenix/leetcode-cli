/** `leetcode show <id>` — render a problem statement in the terminal. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { renderProblem } from '../lib/problemView.js';

export function registerShow(program: Command): void {
  program
    .command('show')
    .description('Display a problem statement')
    .argument('<id>', 'problem id or slug')
    .option('-x, --hints', 'include hints')
    .action(async (id: string, opts: { hints?: boolean }) => {
      const client = new LeetCodeClient(config);
      const slug = await client.resolveSlug(id);
      const q = await client.questionDetail(slug);
      console.log(renderProblem(q, { site: config.site, showHints: Boolean(opts.hints) }));
    });
}
