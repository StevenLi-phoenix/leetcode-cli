/** `leetcode pick <id>` — generate a solution file seeded with the starter code. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { config } from '../config.js';
import type { AppConfig } from '../config.js';
import { LeetCodeClient } from '../api/client.js';
import type { Question } from '../api/schemas.js';
import { NotFoundError } from '../lib/errors.js';
import { normalizeLang, findSnippet, availableLangs, solutionPath, buildSolutionFile } from '../lib/files.js';
import { renderProblem } from '../lib/problemView.js';
import { chalk } from '../lib/format.js';

export interface PickResult {
  readonly file: string;
  readonly created: boolean;
  readonly lang: string;
}

/** Minimal problem identity needed to write a solution file. */
export interface SolutionInput {
  readonly frontendId: string;
  readonly questionId: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: string;
}

/**
 * Write `code` to the conventional `problems/{id}.{slug}.{ext}` path with the
 * `@leetcode` metadata header, and record it in the manifest. Shared by `pick`
 * (starter snippet) and `pull` (your accepted submission). Existing files are
 * left untouched unless `force` is set.
 */
export function writeSolution(
  cfg: AppConfig,
  input: SolutionInput,
  lang: string,
  code: string,
  opts: { force?: boolean } = {},
): PickResult {
  const file = solutionPath({ workdir: cfg.workdir, frontendId: input.frontendId, slug: input.slug, langSlug: lang });

  let created = false;
  if (!fs.existsSync(file) || opts.force) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const content = buildSolutionFile(code, {
      id: input.frontendId,
      questionId: input.questionId,
      slug: input.slug,
      lang,
      title: input.title,
      site: cfg.site,
    });
    fs.writeFileSync(file, content);
    created = true;
  }

  cfg.rememberProblem({
    id: input.frontendId,
    questionId: input.questionId,
    slug: input.slug,
    title: input.title,
    difficulty: input.difficulty,
    file,
    lang,
    site: cfg.site,
  });

  return { file, created, lang };
}

/** Shared pick logic, reused by `daily --pick` and `random --pick`. */
export async function doPick(
  cfg: AppConfig,
  q: Question,
  opts: { lang?: string; force?: boolean } = {},
): Promise<PickResult> {
  const lang = normalizeLang(opts.lang ?? cfg.lang);
  const snippet = findSnippet(q.codeSnippets ?? [], lang);
  if (!snippet) {
    const avail = availableLangs(q.codeSnippets ?? []);
    throw new NotFoundError(
      `Problem ${q.questionFrontendId} has no ${lang} starter code.`,
      avail.length ? `Available languages: ${avail.join(', ')}` : 'This problem has no code snippets (premium or unsupported).',
    );
  }

  return writeSolution(
    cfg,
    { frontendId: q.questionFrontendId, questionId: q.questionId, slug: q.titleSlug, title: q.title, difficulty: q.difficulty },
    lang,
    snippet.code,
    { force: opts.force },
  );
}

/** Consistent "created / exists" line, shared by pick, daily, and random. */
export function printPickResult(result: PickResult, opts: { hint?: boolean } = {}): void {
  if (result.created) {
    console.log(chalk.green(`✔ Created ${result.file}`));
  } else {
    console.log(chalk.yellow(`• Exists  ${result.file}${opts.hint ? ' (use --force to overwrite)' : ''}`));
  }
}

function openEditor(editor: string, file: string): void {
  const parts = editor.split(' ').filter(Boolean);
  const cmd = parts[0];
  if (!cmd) return;
  const child = spawn(cmd, [...parts.slice(1), file], { stdio: 'inherit' });
  child.on('error', () => console.log(chalk.yellow(`Could not open editor "${editor}".`)));
}

export function registerPick(program: Command): void {
  program
    .command('pick')
    .description('Generate a solution file for a problem')
    .argument('<id>', 'problem id or slug')
    .option('-l, --lang <lang>', 'language (defaults to the configured lang)')
    .option('-f, --force', 'overwrite an existing file')
    .option('--show', 'also print the problem statement')
    .option('--open', 'open the file in your configured editor')
    .action(async (id: string, opts: { lang?: string; force?: boolean; show?: boolean; open?: boolean }) => {
      const client = new LeetCodeClient(config);
      const slug = await client.resolveSlug(id);
      const q = await client.questionDetail(slug);

      if (opts.show) {
        console.log(renderProblem(q, { site: config.site }));
        console.log();
      }

      const result = await doPick(config, q, opts);
      printPickResult(result, { hint: true });
      console.log(chalk.dim(`Language: ${result.lang}  ·  id: ${q.questionFrontendId}  ·  ${q.titleSlug}`));

      if (opts.open) {
        if (config.editor) openEditor(config.editor, result.file);
        else console.log(chalk.yellow('No editor configured. Set one with `leetcode config editor "code -w"`.'));
      }
    });
}
