/** `leetcode whoami` — show the currently signed-in user. */
import type { Command } from 'commander';
import { config } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { AuthError } from '../lib/errors.js';
import { chalk } from '../lib/format.js';

export function registerWhoami(program: Command): void {
  program
    .command('whoami')
    .description('Show the currently signed-in user')
    .action(async () => {
      const client = new LeetCodeClient(config);
      const status = await client.userStatus();
      if (!status.isSignedIn) {
        throw new AuthError('Not signed in.');
      }
      console.log(`${chalk.bold(status.username ?? status.userSlug ?? 'unknown')}${status.realName ? chalk.dim(` (${status.realName})`) : ''}`);
      console.log(chalk.dim(`Site:    ${config.site}`));
      if (status.isPremium != null) console.log(chalk.dim(`Premium: ${status.isPremium ? 'yes' : 'no'}`));
      console.log(chalk.dim(`Auth:    ${config.isUsingEnvCredentials() ? 'environment' : 'stored config'}`));
    });
}
