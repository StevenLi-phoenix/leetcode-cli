/** `leetcode logout` — clear stored credentials for the active site. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { chalk } from '../lib/format.js';

export function registerLogout(program: Command): void {
  program
    .command('logout')
    .description('Remove stored credentials for the active site')
    .action(() => {
      config.clearCredentials();
      console.log(chalk.green(`✔ Logged out of ${config.site}.`));
      if (config.isUsingEnvCredentials()) {
        console.log(chalk.yellow('Note: LEETCODE_SESSION / LEETCODE_CSRF_TOKEN are still set in the environment.'));
      }
    });
}
