/** `leetcode test <target>` — run a solution against example/custom test cases. */
import fs from 'node:fs';
import type { Command } from 'commander';
import ora from 'ora';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { resolveSolution } from '../lib/solve.js';
import { renderRunResult } from '../lib/judge.js';
import { isFile } from '../lib/files.js';
import { UsageError, ApiError, NotFoundError } from '../lib/errors.js';

interface TestOpts {
  lang?: string;
  file?: string;
  testcase?: string;
  testcaseFile?: string;
}

export function registerTest(program: Command): void {
  program
    .command('test')
    .description('Run your solution against example (or custom) test cases')
    .argument('<target>', 'problem id/slug, or a solution file path')
    .option('-l, --lang <lang>', 'language (for files without a metadata header)')
    .option('-f, --file <file>', 'explicit solution file to run')
    .option('-c, --testcase <input>', 'custom test input (use \\n for line breaks)')
    .option('--testcase-file <path>', 'read custom test input from a file')
    .action(async (target: string, opts: TestOpts) => {
      const client = new LeetCodeClient(config);
      const sol = await resolveSolution(client, config, target, { lang: opts.lang, file: opts.file });

      let dataInput = '';
      if (opts.testcaseFile) {
        if (!isFile(opts.testcaseFile)) throw new NotFoundError(`Testcase file not found: ${opts.testcaseFile}`);
        dataInput = fs.readFileSync(opts.testcaseFile, 'utf8');
      } else if (opts.testcase) {
        dataInput = opts.testcase.replace(/\\n/g, '\n');
      } else {
        const q = await client.questionDetail(sol.slug);
        dataInput = q.exampleTestcases ?? q.sampleTestCase ?? '';
      }
      if (!dataInput.trim()) {
        throw new UsageError('No test input available for this problem.', 'Provide one with -c "<input>".');
      }

      const spinner = ora(`Running ${sol.slug} (${sol.lang})…`).start();
      try {
        const { interpretId, expectedId } = await client.interpret(sol.slug, {
          lang: sol.lang,
          questionId: sol.questionId,
          code: sol.code,
          dataInput,
        });
        const result = await client.pollCheck(interpretId, (s) => {
          spinner.text = `Judging… (${s.toLowerCase()})`;
        });

        let expected: string[] | undefined;
        if (expectedId && !(result.expected_code_answer && result.expected_code_answer.length)) {
          try {
            const exp = await client.pollCheck(expectedId);
            expected = exp.code_answer;
          } catch {
            /* expected output is best-effort */
          }
        }
        spinner.stop();
        if (result.state === 'FAILURE') throw new ApiError('The judge reported a failure. Please try again.');
        console.log(renderRunResult(result, expected));
        // Non-zero only on a real failure or a graded-wrong answer; a custom
        // (ungraded) run that merely executed exits 0.
        if (result.status_code !== 10 || result.correct_answer === false) process.exitCode = 1;
      } catch (err) {
        spinner.stop();
        throw err;
      }
    });
}
