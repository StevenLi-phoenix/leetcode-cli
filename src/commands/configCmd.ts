/**
 * `leetcode config [key] [value]` — view or change settings.
 *
 *   leetcode config                 # show everything
 *   leetcode config lang python3    # set the default language
 *   leetcode config site            # show one value
 */
import type { Command } from 'commander';
import { config, parseSite } from '../config.js';
import { UsageError } from '../lib/errors.js';
import { normalizeLang } from '../lib/files.js';
import { chalk } from '../lib/format.js';

const KEYS = ['site', 'lang', 'workdir', 'editor'] as const;
type Key = (typeof KEYS)[number];

function isKey(s: string): s is Key {
  return (KEYS as readonly string[]).includes(s);
}

function show(key: Key): string {
  switch (key) {
    case 'site':
      return config.site;
    case 'lang':
      return config.lang;
    case 'workdir':
      return config.workdir;
    case 'editor':
      return config.editor ?? '(unset)';
  }
}

export function registerConfig(program: Command): void {
  program
    .command('config')
    .description('View or change settings (site, lang, workdir, editor)')
    .argument('[key]', `one of: ${KEYS.join(', ')}`)
    .argument('[value]', 'the new value (omit to read)')
    .action((key: string | undefined, value: string | undefined) => {
      if (!key) {
        for (const k of KEYS) console.log(`${chalk.cyan(k.padEnd(8))} ${show(k)}`);
        console.log(chalk.dim(`\nconfig file: ${config.path}`));
        return;
      }
      if (!isKey(key)) throw new UsageError(`Unknown key "${key}".`, `Valid keys: ${KEYS.join(', ')}.`);
      if (value === undefined) {
        console.log(show(key));
        return;
      }
      switch (key) {
        case 'site':
          config.site = parseSite(value);
          break;
        case 'lang':
          config.lang = normalizeLang(value);
          break;
        case 'workdir':
          config.workdir = value;
          break;
        case 'editor':
          config.editor = value;
          break;
      }
      console.log(chalk.green(`✔ ${key} = ${show(key)}`));
    });
}
