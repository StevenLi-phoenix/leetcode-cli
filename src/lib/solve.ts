/**
 * Resolve a `test`/`submit` argument into everything needed to run code:
 * the slug, the internal questionId, the language, and the (header-stripped)
 * source. The argument may be an existing solution file or a problem id/slug;
 * files picked by `leetcode pick` carry a metadata header we read directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../config.js';
import type { LeetCodeClient } from '../api/client.js';
import { NotFoundError, UsageError } from './errors.js';
import {
  isFile,
  normalizeLang,
  parseHeader,
  stripHeader,
  solutionPathForQuestion,
  extToLang,
} from './files.js';

export interface ResolvedSolution {
  readonly slug: string;
  readonly questionId: string;
  readonly frontendId: string;
  readonly title: string;
  readonly lang: string;
  readonly code: string;
  readonly file: string;
}

export async function resolveSolution(
  client: LeetCodeClient,
  cfg: AppConfig,
  arg: string,
  opts: { lang?: string; file?: string } = {},
): Promise<ResolvedSolution> {
  const explicitFile = opts.file ?? (isFile(arg) ? arg : undefined);
  if (explicitFile) return fromFile(client, explicitFile, opts.lang);

  // arg is an id or slug: resolve it, fetch detail, then find the file.
  const slug = await client.resolveSlug(arg);
  const q = await client.questionDetail(slug);
  const lang = normalizeLang(opts.lang ?? cfg.lang);

  const manifest = cfg.lookupProblem(q.questionFrontendId);
  let file = manifest?.file;
  if (!file || !isFile(file)) {
    file = solutionPathForQuestion(cfg.workdir, q, lang);
  }
  if (!isFile(file)) {
    throw new NotFoundError(
      `No solution file found for problem ${q.questionFrontendId} (${slug}).`,
      `Run \`leetcode pick ${arg} --lang ${lang}\` first, or pass a file path.`,
    );
  }
  const code = stripHeader(fs.readFileSync(file, 'utf8'));
  return { slug, questionId: q.questionId, frontendId: q.questionFrontendId, title: q.title, lang, code, file };
}

async function fromFile(client: LeetCodeClient, file: string, langOpt?: string): Promise<ResolvedSolution> {
  if (!isFile(file)) throw new NotFoundError(`File not found: ${file}`);
  const raw = fs.readFileSync(file, 'utf8');
  const header = parseHeader(raw);
  const code = stripHeader(raw);

  if (header?.slug && header.questionId && header.lang) {
    return {
      slug: header.slug,
      questionId: header.questionId,
      frontendId: header.id ?? '',
      title: header.title ?? header.slug,
      lang: header.lang,
      code,
      file,
    };
  }

  // No (complete) header: derive slug from the `{id}.{slug}.{ext}` filename and
  // language from --lang or the extension, then look up the internal id.
  const base = path.basename(file);
  const match = base.match(/^(\d+)\.(.+)\.([^.]+)$/);
  const ext = path.extname(file).slice(1);
  const lang = langOpt ? normalizeLang(langOpt) : extToLang(ext);
  if (!lang) {
    throw new UsageError(`Cannot determine the language of ${base}.`, 'Pass --lang explicitly.');
  }
  if (!match) {
    throw new UsageError(
      `Cannot determine the problem from ${base}.`,
      'Use a file created by `leetcode pick`, or pass the problem id/slug instead.',
    );
  }
  const slug = match[2] as string;
  const q = await client.questionDetail(slug);
  return { slug, questionId: q.questionId, frontendId: q.questionFrontendId, title: q.title, lang, code, file };
}
