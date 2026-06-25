/** `leetcode daily` — show (and optionally pick) today's daily challenge. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { renderProblem } from '../lib/problemView.js';
import { doPick, printPickResult } from './pick.js';
import { chalk } from '../lib/format.js';

export function registerDaily(program: Command): void {
  program
    .command('daily')
    .description("Show today's daily challenge")
    .option('-p, --pick', 'also generate a solution file')
    .option('-l, --lang <lang>', 'language for --pick')
    .action(async (opts: { pick?: boolean; lang?: string }) => {
      const client = new LeetCodeClient(config);
      const daily = await client.daily();
      console.log(chalk.dim(`Daily challenge${daily.date ? ` · ${daily.date}` : ''}`));
      const q = await client.questionDetail(daily.slug);
      console.log(renderProblem(q, { site: config.site }));

      if (opts.pick) {
        console.log();
        printPickResult(await doPick(config, q, { lang: opts.lang }));
      }
    });
}
