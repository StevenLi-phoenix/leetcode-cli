#!/usr/bin/env node
/**
 * leetcode-cli entrypoint.
 *
 * Wires every command into a single commander program, supports a global
 * `--site` override, and centralises error handling so commands can simply
 * throw a CliError for clean, friendly output.
 */
import { Command } from 'commander';
import { isCliError } from './lib/errors.js';
import { parseSite } from './config.js';
import { chalk } from './lib/format.js';
import { registerLogin } from './commands/login.js';
import { registerLogout } from './commands/logout.js';
import { registerWhoami } from './commands/whoami.js';
import { registerConfig } from './commands/configCmd.js';
import { registerList } from './commands/list.js';
import { registerShow } from './commands/show.js';
import { registerHint } from './commands/hint.js';
import { registerPick } from './commands/pick.js';
import { registerTest } from './commands/test.js';
import { registerSubmit } from './commands/submit.js';
import { registerDaily } from './commands/daily.js';
import { registerRandom } from './commands/random.js';
import { registerTimer } from './commands/timer.js';
import { registerSnapshot } from './commands/snapshot.js';

// Kept in sync with package.json's version.
const VERSION = '0.1.0';

const program = new Command();

program
  .name('leetcode')
  .description('A minimal LeetCode CLI for terminal-driven problem solving')
  .version(VERSION, '-v, --version')
  .option('--site <site>', 'override the active site for this run (leetcode.com | leetcode.cn)')
  .showHelpAfterError('(add --help for usage)')
  .hook('preAction', () => {
    const site = program.opts().site as string | undefined;
    if (site) process.env.LEETCODE_SITE = parseSite(site);
  });

for (const register of [
  registerLogin,
  registerLogout,
  registerWhoami,
  registerConfig,
  registerList,
  registerShow,
  registerHint,
  registerPick,
  registerTest,
  registerSubmit,
  registerDaily,
  registerRandom,
  registerTimer,
  registerSnapshot,
]) {
  register(program);
}

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (isCliError(err)) {
      console.error(chalk.red(`✖ ${err.message}`));
      if (err.hint) console.error(chalk.dim(`  ${err.hint}`));
      // Set exitCode rather than process.exit() so buffered output flushes.
      process.exitCode = err.exitCode;
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`✖ ${message}`));
    if (process.env.DEBUG) console.error(err);
    process.exitCode = 1;
  }
}

void main();
