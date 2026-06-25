/**
 * Render a full problem (header + metadata + statement) for the terminal.
 * Shared by `show` and `daily`. On leetcode.cn the translated title/body are
 * preferred when present.
 */
import type { Question } from '../api/schemas.js';
import type { Site } from '../config.js';
import { renderHtml } from './render.js';
import { difficulty as fmtDifficulty, heading, rule, chalk } from './format.js';

export interface ProblemViewOptions {
  readonly site: Site;
  readonly showHints?: boolean;
}

function acRateFromStats(stats: string | null | undefined): string | null {
  if (!stats) return null;
  try {
    const parsed = JSON.parse(stats) as { acRate?: string };
    return parsed.acRate ?? null;
  } catch {
    return null;
  }
}

export function renderProblem(q: Question, opts: ProblemViewOptions): string {
  const cn = opts.site === 'leetcode.cn';
  const title = (cn ? q.translatedTitle : null) ?? q.title;
  const body = (cn ? q.translatedContent : null) ?? q.content ?? '';

  const lines: string[] = [];
  lines.push(heading(`${q.questionFrontendId}. ${title}`));

  const meta: string[] = [fmtDifficulty(q.difficulty)];
  if (q.isPaidOnly) meta.push(chalk.yellow('Premium'));
  const ac = acRateFromStats(q.stats);
  if (ac) meta.push(`AC ${ac}`);
  if (typeof q.likes === 'number') meta.push(chalk.dim(`\u{1F44D} ${q.likes}`));
  if (typeof q.dislikes === 'number') meta.push(chalk.dim(`\u{1F44E} ${q.dislikes}`));
  lines.push(meta.join('  '));

  const tags = (q.topicTags ?? [])
    .map((t) => (cn ? t?.translatedName ?? t?.nameTranslated ?? t?.name : t?.name) ?? '')
    .filter(Boolean);
  if (tags.length) lines.push(chalk.dim(`Tags: ${tags.join(', ')}`));
  lines.push(chalk.dim(`https://${opts.site}/problems/${q.titleSlug}/`));

  lines.push(rule());
  lines.push(body ? renderHtml(body) : chalk.dim('(no description — this may be a premium problem)'));

  if (opts.showHints && q.hints && q.hints.length > 0) {
    lines.push('');
    lines.push(heading(`Hints (${q.hints.length})`));
    q.hints.forEach((h, i) => lines.push(`${chalk.yellow(`${i + 1}.`)} ${renderHtml(h)}`));
  }

  return lines.join('\n');
}
