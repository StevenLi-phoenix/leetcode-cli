/** `leetcode submit <target>` — submit a solution and report the verdict. */
import type { Command } from 'commander';
import ora from 'ora';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { resolveSolution } from '../lib/solve.js';
import { renderSubmitResult, isAccepted } from '../lib/judge.js';
import { ApiError } from '../lib/errors.js';

interface SubmitOpts {
  lang?: string;
  file?: string;
}

export function registerSubmit(program: Command): void {
  program
    .command('submit')
    .description('Submit your solution to LeetCode')
    .argument('<target>', 'problem id/slug, or a solution file path')
    .option('-l, --lang <lang>', 'language (for files without a metadata header)')
    .option('-f, --file <file>', 'explicit solution file to submit')
    .action(async (target: string, opts: SubmitOpts) => {
      const client = new LeetCodeClient(config);
      const sol = await resolveSolution(client, config, target, { lang: opts.lang, file: opts.file });

      const spinner = ora(`Submitting ${sol.slug} (${sol.lang})…`).start();
      try {
        const id = await client.submit(sol.slug, { lang: sol.lang, questionId: sol.questionId, code: sol.code });
        const result = await client.pollCheck(String(id), (s) => {
          spinner.text = `Judging… (${s.toLowerCase()})`;
        });
        spinner.stop();
        if (result.state === 'FAILURE') throw new ApiError('The judge reported a failure. Please try again.');
        console.log(renderSubmitResult(result));
        if (!isAccepted(result, 'submit')) process.exitCode = 1;
      } catch (err) {
        spinner.stop();
        throw err;
      }
    });
}
