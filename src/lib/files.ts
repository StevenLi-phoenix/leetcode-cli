/**
 * Solution-file conventions: language ↔ extension mapping, where a picked file
 * is written ({difficulty}/{category}/{id}.{slug}.{ext}), and the metadata
 * header that lets `test`/`submit` recover a problem's identity from a file.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CodeSnippet } from '../api/schemas.js';

/** True if the path exists and is a regular file. */
export function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** langSlug → source file extension (without the dot). */
const LANG_EXT: Record<string, string> = {
  cpp: 'cpp',
  java: 'java',
  python: 'py',
  python3: 'py',
  pythondata: 'py',
  c: 'c',
  csharp: 'cs',
  javascript: 'js',
  typescript: 'ts',
  php: 'php',
  swift: 'swift',
  kotlin: 'kt',
  dart: 'dart',
  golang: 'go',
  ruby: 'rb',
  scala: 'scala',
  rust: 'rs',
  racket: 'rkt',
  erlang: 'erl',
  elixir: 'ex',
  bash: 'sh',
  mysql: 'sql',
  mssql: 'sql',
  oraclesql: 'sql',
  postgresql: 'sql',
  cangjie: 'cj',
};

/** Human-typed aliases → canonical LeetCode langSlug. */
const LANG_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  py: 'python3',
  python2: 'python',
  cs: 'csharp',
  'c#': 'csharp',
  js: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  kt: 'kotlin',
  rs: 'rust',
  go: 'golang',
  sql: 'mysql',
};

/** Line-comment prefix per langSlug (used for the metadata header). */
const LANG_COMMENT: Record<string, string> = {
  python: '#', python3: '#', pythondata: '#', ruby: '#', bash: '#', elixir: '#',
  mysql: '--', mssql: '--', oraclesql: '--', postgresql: '--',
  racket: ';',
  erlang: '%',
};

/** Resolve a user-supplied language name to a canonical langSlug. */
export function normalizeLang(input: string): string {
  const key = input.trim().toLowerCase();
  return LANG_ALIASES[key] ?? key;
}

/** File extension (no dot) for a langSlug; falls back to the slug itself. */
export function langExtension(langSlug: string): string {
  return LANG_EXT[langSlug] ?? langSlug;
}

/** Best-effort reverse map: file extension → canonical langSlug. */
const EXT_LANG: Record<string, string> = {
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'cpp',
  java: 'java', py: 'python3', cs: 'csharp', js: 'javascript', mjs: 'javascript',
  ts: 'typescript', php: 'php', swift: 'swift', kt: 'kotlin', dart: 'dart',
  go: 'golang', rb: 'ruby', scala: 'scala', sc: 'scala', rs: 'rust',
  rkt: 'racket', erl: 'erlang', ex: 'elixir', exs: 'elixir', sh: 'bash',
  sql: 'mysql', cj: 'cangjie',
};

/** Guess a langSlug from a file extension (no dot); undefined if unknown. */
export function extToLang(ext: string): string | undefined {
  return EXT_LANG[ext.toLowerCase()];
}

/** Line-comment prefix for a langSlug (defaults to `//`). */
export function commentPrefix(langSlug: string): string {
  return LANG_COMMENT[langSlug] ?? '//';
}

/** Find the starter snippet for a language; null if the problem lacks it. */
export function findSnippet(snippets: readonly CodeSnippet[], langSlug: string): CodeSnippet | null {
  return snippets.find((s) => s.langSlug === langSlug) ?? null;
}

/** Languages a problem offers, as langSlugs. */
export function availableLangs(snippets: readonly CodeSnippet[]): string[] {
  return snippets.map((s) => s.langSlug);
}

/** Sanitise an arbitrary string into a safe path segment (no traversal). */
function safeSegment(s: string): string {
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, ''); // strip leading/trailing dots & hyphens → blocks '.', '..'
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'problem';
}

/** Subdirectory under the workdir where solution files live. */
export const PROBLEMS_DIR = 'problems';

export interface SolutionPathParts {
  readonly workdir: string;
  readonly frontendId: string;
  readonly slug: string;
  readonly langSlug: string;
}

/** Absolute path of a picked solution: {workdir}/problems/{id}.{slug}.{ext} */
export function solutionPath(parts: SolutionPathParts): string {
  const ext = langExtension(parts.langSlug);
  const filename = `${parts.frontendId}.${safeSegment(parts.slug)}.${ext}`;
  return path.join(parts.workdir, PROBLEMS_DIR, filename);
}

/** Minimal shape needed to compute a problem's solution path. */
export interface QuestionLike {
  readonly questionFrontendId: string;
  readonly titleSlug: string;
}

/** Conventional solution path for a problem. */
export function solutionPathForQuestion(workdir: string, q: QuestionLike, langSlug: string): string {
  return solutionPath({ workdir, frontendId: q.questionFrontendId, slug: q.titleSlug, langSlug });
}

export interface SolutionMeta {
  readonly id: string;
  readonly questionId: string;
  readonly slug: string;
  readonly lang: string;
  readonly title: string;
  readonly site: string;
}

const HEADER_MARK = '@leetcode';
// Matches our generated header specifically (`@leetcode id=…`), so an
// unrelated `@leetcode` mention in the user's own code is never treated as one.
const HEADER_RE = /@leetcode\s+id=/;

/** Build a file body: a one-line metadata header comment followed by the code. */
export function buildSolutionFile(code: string, meta: SolutionMeta): string {
  const c = commentPrefix(meta.lang);
  const title = meta.title.replace(/[\r\n]+/g, ' ').replace(/"/g, "'");
  const header =
    `${c} ${HEADER_MARK} id=${meta.id} questionId=${meta.questionId} ` +
    `slug=${meta.slug} lang=${meta.lang} site=${meta.site} title="${title}"`;
  const body = code.endsWith('\n') ? code : code + '\n';
  return `${header}\n${body}`;
}

/** Parse our metadata header out of a solution file; null if absent. */
export function parseHeader(content: string): Partial<SolutionMeta> | null {
  const firstLine = content.split('\n', 1)[0] ?? '';
  if (!HEADER_RE.test(firstLine)) return null;
  const get = (k: string): string | undefined => {
    const m = firstLine.match(new RegExp(`${k}=("([^"]*)"|([^\\s]+))`));
    return m ? (m[2] ?? m[3]) : undefined;
  };
  return {
    id: get('id'),
    questionId: get('questionId'),
    slug: get('slug'),
    lang: get('lang'),
    site: get('site'),
    title: get('title'),
  };
}

/**
 * Remove only the leading metadata header line(s) before sending code to the
 * judge. We stop at the first non-header line so a legitimate `@leetcode`
 * mention deeper in the user's code is preserved.
 */
export function stripHeader(content: string): string {
  const lines = content.split('\n');
  let start = 0;
  while (start < lines.length && HEADER_RE.test(lines[start] ?? '')) start++;
  return lines.slice(start).join('\n').replace(/^\n+/, '');
}
