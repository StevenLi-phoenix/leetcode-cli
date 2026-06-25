/**
 * `leetcode pull [target]` — download your *accepted* submissions from LeetCode
 * into local solution files, using the same `problems/{id}.{slug}.{ext}` layout
 * and `@leetcode` header that `pick` writes (so `test`/`submit` keep working).
 *
 *   leetcode pull 1            # latest accepted submission for one problem
 *   leetcode pull --all        # every solved problem (your whole AC history)
 *   leetcode pull --all -l cpp # only C++ submissions
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import ora from 'ora';
import { config } from '../config.js';
import type { AppConfig } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import { writeSolution } from './pick.js';
import type { PickResult, SolutionInput } from './pick.js';
import { normalizeLang, PROBLEMS_DIR } from '../lib/files.js';
import { NotFoundError, UsageError } from '../lib/errors.js';
import { chalk } from '../lib/format.js';

interface PullOpts {
  lang?: string;
  force?: boolean;
  all?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pull one problem's latest accepted submission into a file. Returns the write
 * result, or null when the user has no matching accepted submission.
 * `input.questionId` may be empty — it is backfilled from the submission detail.
 */
async function pullOne(
  client: LeetCodeClient,
  cfg: AppConfig,
  input: SolutionInput,
  opts: { lang?: string; force?: boolean },
): Promise<PickResult | null> {
  // With an explicit -l, pull strictly that language. Otherwise prefer the
  // configured language (e.g. cpp) but fall back to any accepted submission, so
  // every solved problem yields exactly one file.
  const ac = opts.lang
    ? await client.latestAcSubmission(input.slug, { lang: opts.lang })
    : await client.bestAcSubmission(input.slug, cfg.lang);
  if (!ac) return null;
  const detail = await client.submissionCode(String(ac.id));
  const lang = normalizeLang(detail.langSlug ?? ac.lang ?? opts.lang ?? cfg.lang);
  const questionId = input.questionId || detail.questionId || '';
  return writeSolution(cfg, { ...input, questionId }, lang, detail.code, { force: opts.force });
}

/** Set of `{id}.{slug}` keys already present in the workdir (any extension). */
function existingSolutionKeys(workdir: string): Set<string> {
  const keys = new Set<string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(path.join(workdir, PROBLEMS_DIR));
  } catch {
    return keys; // no problems/ dir yet
  }
  for (const name of entries) {
    const m = name.match(/^(\d+)\.(.+)\.([^.]+)$/);
    if (m) keys.add(`${m[1]}.${m[2]}`);
  }
  return keys;
}

async function pullSingle(client: LeetCodeClient, target: string, opts: PullOpts): Promise<void> {
  const slug = await client.resolveSlug(target);
  const q = await client.questionDetail(slug);
  const spinner = ora(`Fetching your submission for ${q.questionFrontendId}.${q.titleSlug}…`).start();
  try {
    const res = await pullOne(
      client,
      config,
      { frontendId: q.questionFrontendId, questionId: q.questionId, slug: q.titleSlug, title: q.title, difficulty: q.difficulty },
      { lang: opts.lang, force: opts.force },
    );
    spinner.stop();
    if (!res) {
      throw new NotFoundError(
        `No accepted${opts.lang ? ` ${opts.lang}` : ''} submission found for ${q.questionFrontendId} (${q.titleSlug}).`,
        'Submit an accepted solution first, or drop --lang.',
      );
    }
    if (res.created) console.log(chalk.green(`✔ Pulled ${res.file}`));
    else console.log(chalk.yellow(`• Exists  ${res.file} (use --force to overwrite)`));
    console.log(chalk.dim(`Language: ${res.lang}  ·  id: ${q.questionFrontendId}  ·  ${q.titleSlug}`));
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function pullAll(client: LeetCodeClient, opts: PullOpts): Promise<void> {
  const spinner = ora('Listing your solved problems…').start();
  // A large limit makes problemList paginate through the entire AC set.
  const { items } = await client.problemList({ status: 'AC', limit: 100_000 });
  spinner.stop();
  if (items.length === 0) {
    console.log('No solved problems found.');
    return;
  }

  const existing = opts.force ? new Set<string>() : existingSolutionKeys(config.workdir);
  let created = 0;
  let skipped = 0;
  let failed = 0;
  console.log(chalk.dim(`Pulling ${items.length} solved problem(s) into ${path.join(config.workdir, PROBLEMS_DIR)}/`));

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    const label = `[${i + 1}/${items.length}] ${it.frontendId}.${it.titleSlug}`;
    if (!opts.force && existing.has(`${it.frontendId}.${it.titleSlug}`)) {
      skipped++;
      console.log(chalk.dim(`• skip   ${label} (exists)`));
      continue;
    }
    try {
      const res = await pullOne(
        client,
        config,
        { frontendId: it.frontendId, questionId: '', slug: it.titleSlug, title: it.title, difficulty: it.difficulty },
        { lang: opts.lang, force: opts.force },
      );
      if (!res) {
        skipped++;
        console.log(chalk.yellow(`• none   ${label} (no${opts.lang ? ` ${opts.lang}` : ''} accepted submission)`));
      } else if (res.created) {
        created++;
        console.log(chalk.green(`✔ pull   ${label} → ${path.basename(res.file)}`));
      } else {
        skipped++;
        console.log(chalk.dim(`• exists ${label}`));
      }
    } catch (err) {
      failed++;
      console.log(chalk.red(`✖ fail   ${label}: ${(err as Error).message}`));
    }
    await sleep(200); // courtesy delay between problems
  }
  console.log(chalk.dim(`\nDone. ${created} pulled, ${skipped} skipped, ${failed} failed.`));
}

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Download your accepted submission(s) into local solution files')
    .argument('[target]', 'problem id or slug (omit when using --all)')
    .option('-l, --lang <lang>', 'only pull submissions in this language')
    .option('-f, --force', 'overwrite existing files')
    .option('--all', 'pull every solved problem (your whole AC history)')
    .action(async (target: string | undefined, opts: PullOpts) => {
      const client = new LeetCodeClient(config);
      if (opts.all) {
        await pullAll(client, opts);
        return;
      }
      if (!target) {
        throw new UsageError('Nothing to pull.', 'Pass a problem id/slug, or use --all to pull every solved problem.');
      }
      await pullSingle(client, target, opts);
    });
}
