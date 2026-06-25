/**
 * `leetcode login` — store the browser session cookie + CSRF token.
 *
 * The user copies `LEETCODE_SESSION` and `csrftoken` from their browser's
 * cookies. Values may be passed via flags or entered interactively, then they
 * are validated with a userStatus call before being saved.
 */
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Command } from 'commander';
import { config, parseSite } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { UsageError, AuthError } from '../lib/errors.js';
import { chalk } from '../lib/format.js';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('Save your LeetCode session cookie (LEETCODE_SESSION + csrftoken)')
    .option('--session <value>', 'LEETCODE_SESSION cookie value')
    .option('--csrf <value>', 'csrftoken cookie value')
    .option('-s, --site <site>', 'site to log in to (leetcode.com | leetcode.cn)')
    .action(async (opts: { session?: string; csrf?: string; site?: string }) => {
      if (opts.site) config.site = parseSite(opts.site);

      if (config.isUsingEnvCredentials()) {
        console.log(chalk.yellow('Note: LEETCODE_SESSION / LEETCODE_CSRF_TOKEN are set in the environment and take precedence.'));
      }

      console.log(chalk.dim(`Logging in to ${config.site}. Copy the cookie values from your browser (DevTools → Application → Cookies).`));
      const session = opts.session ?? (await prompt('LEETCODE_SESSION: '));
      const csrftoken = opts.csrf ?? (await prompt('csrftoken: '));
      if (!session || !csrftoken) {
        throw new UsageError('Both LEETCODE_SESSION and csrftoken are required.');
      }

      config.setCredentials({ session, csrftoken });
      const client = new LeetCodeClient(config);
      try {
        const status = await client.userStatus();
        if (!status.isSignedIn) {
          config.clearCredentials();
          throw new AuthError('The provided cookies are not valid (not signed in).');
        }
        console.log(chalk.green(`✔ Logged in as ${chalk.bold(status.username ?? 'unknown')} on ${config.site}.`));
      } catch (err) {
        config.clearCredentials();
        throw err;
      }
    });
}
