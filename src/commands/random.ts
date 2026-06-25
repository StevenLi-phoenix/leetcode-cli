/** `leetcode random` — show a random problem matching optional filters. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { renderProblem } from '../lib/problemView.js';
import { parseDifficulty } from './list.js';
import { doPick, printPickResult } from './pick.js';

export function registerRandom(program: Command): void {
  program
    .command('random')
    .alias('rand')
    .description('Show a random problem (optionally filtered)')
    .option('-d, --difficulty <level>', 'easy | medium | hard')
    .option('-t, --tag <tag...>', 'filter by topic-tag slug(s)')
    .option('-p, --pick', 'also generate a solution file')
    .option('-l, --lang <lang>', 'language for --pick')
    .action(async (opts: { difficulty?: string; tag?: string[]; pick?: boolean; lang?: string }) => {
      const client = new LeetCodeClient(config);
      const difficulty = parseDifficulty(opts.difficulty);

      // Probe the total, then jump to a random offset for an even draw.
      const probe = await client.problemList({ difficulty, tags: opts.tag, limit: 1, skip: 0 });
      if (probe.total === 0) {
        console.log('No problems match those filters.');
        return;
      }
      const skip = Math.floor(Math.random() * probe.total);
      const { items } = await client.problemList({ difficulty, tags: opts.tag, limit: 1, skip });
      const chosen = items[0] ?? probe.items[0];
      if (!chosen) {
        console.log('No problems match those filters.');
        return;
      }

      const q = await client.questionDetail(chosen.titleSlug);
      console.log(renderProblem(q, { site: config.site }));

      if (opts.pick) {
        console.log();
        printPickResult(await doPick(config, q, { lang: opts.lang }));
      }
    });
}
