/**
 * `leetcode snapshot <save|list|diff|restore> <target> [label]`
 *
 * Local versioning of solution files. Snapshots are stored in the config
 * (label + content), so you can diff your current file against a saved version
 * or roll back. `restore` auto-snapshots the current file first.
 *
 * `[label]` selects a snapshot for diff/restore: either its label or the
 * numeric index shown by `snapshot list`. With no label, the latest
 * user-created snapshot is used (auto `before-restore-*` entries are skipped).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import { diffLines } from 'diff';
import { config } from '../config.js';
import type { AppConfig, SnapshotEntry } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { UsageError, NotFoundError } from '../lib/errors.js';
import { isFile, normalizeLang, parseHeader, solutionPathForQuestion, extToLang } from '../lib/files.js';
import { chalk, rule } from '../lib/format.js';

const ACTIONS = ['save', 'list', 'diff', 'restore'] as const;
type Action = (typeof ACTIONS)[number];

const AUTO_PREFIX = 'before-restore-';

interface Target {
  readonly key: string;
  readonly file: string;
  readonly lang: string;
}

/** Resolve a snapshot target to a storage key + file path (file may not exist). */
async function resolveTarget(client: LeetCodeClient, cfg: AppConfig, target: string, langOpt?: string): Promise<Target> {
  if (isFile(target)) {
    const header = parseHeader(fs.readFileSync(target, 'utf8'));
    const base = path.basename(target);
    // Key by problem id, consistently with id/slug targets: header id, else the
    // leading `{id}.` of a picked filename, else the basename as a last resort.
    const key = header?.id ?? base.match(/^(\d+)\./)?.[1] ?? base;
    const lang = header?.lang ?? extToLang(path.extname(target).slice(1)) ?? cfg.lang;
    return { key, file: target, lang };
  }
  const slug = await client.resolveSlug(target);
  const q = await client.questionDetail(slug);
  const lang = normalizeLang(langOpt ?? cfg.lang);
  const manifest = cfg.lookupProblem(q.questionFrontendId);
  const file = manifest?.file ?? solutionPathForQuestion(cfg.workdir, q, lang);
  return { key: q.questionFrontendId, file, lang };
}

/** Select a snapshot by numeric index or label; default = latest user one. */
function selectSnapshot(snapshots: readonly SnapshotEntry[], label: string | undefined): SnapshotEntry | undefined {
  if (label !== undefined) {
    if (/^\d+$/.test(label)) {
      const idx = Number(label);
      if (idx >= 0 && idx < snapshots.length) return snapshots[idx];
    }
    // Most-recent match wins for duplicate labels.
    return [...snapshots].reverse().find((s) => s.label === label);
  }
  return [...snapshots].reverse().find((s) => !s.label.startsWith(AUTO_PREFIX)) ?? snapshots[snapshots.length - 1];
}

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function printDiff(oldStr: string, newStr: string): void {
  const parts = diffLines(oldStr, newStr);
  let changes = 0;
  for (const part of parts) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.dim;
    if (part.added || part.removed) changes++;
    for (const line of part.value.replace(/\n$/, '').split('\n')) {
      console.log(color(`${prefix} ${line}`));
    }
  }
  if (changes === 0) console.log(chalk.dim('(no differences)'));
}

export function registerSnapshot(program: Command): void {
  program
    .command('snapshot')
    .alias('snap')
    .description('Save / list / diff / restore local solution versions')
    .argument('<action>', `one of: ${ACTIONS.join(', ')}`)
    .argument('<target>', 'problem id/slug, or a solution file path')
    .argument('[label]', 'snapshot label or index (for save: name it; diff/restore: select it)')
    .option('-l, --lang <lang>', 'language (when resolving by id)')
    .action(async (action: string, target: string, label: string | undefined, opts: { lang?: string }) => {
      if (!(ACTIONS as readonly string[]).includes(action)) {
        throw new UsageError(`Unknown action "${action}".`, `Use one of: ${ACTIONS.join(', ')}.`);
      }
      const client = new LeetCodeClient(config);
      const { key, file, lang } = await resolveTarget(client, config, target, opts.lang);
      const snapshots = config.getSnapshots(key);

      switch (action as Action) {
        case 'save': {
          if (!isFile(file)) throw new NotFoundError(`No solution file to snapshot: ${file}`);
          const content = fs.readFileSync(file, 'utf8');
          const entry: SnapshotEntry = { label: label ?? timestampLabel(), file, lang, savedAt: new Date().toISOString(), content };
          config.addSnapshot(key, entry);
          console.log(chalk.green(`✔ Saved snapshot "${entry.label}" for #${key} (${snapshots.length + 1} total).`));
          break;
        }
        case 'list': {
          if (snapshots.length === 0) {
            console.log(`No snapshots for #${key}.`);
            return;
          }
          console.log(chalk.bold(`Snapshots for #${key}`));
          console.log(rule());
          snapshots.forEach((s, i) =>
            console.log(`${chalk.cyan(String(i))} ${chalk.bold(s.label)}  ${chalk.dim(s.savedAt)}  ${chalk.dim(`${s.content.length} bytes`)}`),
          );
          break;
        }
        case 'diff': {
          if (snapshots.length === 0) throw new NotFoundError(`No snapshots for #${key}.`);
          const snap = selectSnapshot(snapshots, label);
          if (!snap) throw new NotFoundError(`No snapshot "${label}" for #${key}.`);
          if (!isFile(file)) throw new NotFoundError(`Current solution file not found: ${file}`);
          const current = fs.readFileSync(file, 'utf8');
          console.log(chalk.dim(`--- snapshot "${snap.label}" (${snap.savedAt})`));
          console.log(chalk.dim(`+++ current ${file}`));
          printDiff(snap.content, current);
          break;
        }
        case 'restore': {
          if (snapshots.length === 0) throw new NotFoundError(`No snapshots for #${key}.`);
          const snap = selectSnapshot(snapshots, label);
          if (!snap) throw new NotFoundError(`No snapshot "${label}" for #${key}.`);
          // Auto-snapshot the current file before overwriting it.
          if (isFile(file)) {
            config.addSnapshot(key, {
              label: `${AUTO_PREFIX}${timestampLabel()}`,
              file,
              lang,
              savedAt: new Date().toISOString(),
              content: fs.readFileSync(file, 'utf8'),
            });
          }
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, snap.content);
          console.log(chalk.green(`✔ Restored "${snap.label}" → ${file}`));
          console.log(chalk.dim('(your previous file was snapshotted first)'));
          break;
        }
      }
    });
}
