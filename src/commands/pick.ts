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
import { normalizeLang, findSnippet, availableLangs, solutionPathForQuestion, buildSolutionFile } from '../lib/files.js';
import { renderProblem } from '../lib/problemView.js';
import { chalk } from '../lib/format.js';

export interface PickResult {
  readonly file: string;
  readonly created: boolean;
  readonly lang: string;
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

  const file = solutionPathForQuestion(cfg.workdir, q, lang);

  let created = false;
  if (!fs.existsSync(file) || opts.force) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const content = buildSolutionFile(snippet.code, {
      id: q.questionFrontendId,
      questionId: q.questionId,
      slug: q.titleSlug,
      lang,
      title: q.title,
      site: cfg.site,
    });
    fs.writeFileSync(file, content);
    created = true;
  }

  cfg.rememberProblem({
    id: q.questionFrontendId,
    questionId: q.questionId,
    slug: q.titleSlug,
    title: q.title,
    difficulty: q.difficulty,
    file,
    lang,
    site: cfg.site,
  });

  return { file, created, lang };
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
