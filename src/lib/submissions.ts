/**
 * Pure helpers for picking among a user's submissions. Kept dependency-free so
 * both the API client and the `pull` command can share them and they stay
 * testable without any network calls.
 */
import type { SubmissionRow } from '../api/schemas.js';
import { normalizeLang } from './files.js';

/**
 * Pick the most recent Accepted submission, optionally restricted to a single
 * language. LeetCode returns `submissionList` newest-first, so the first match
 * is the latest. `lang` is normalised (e.g. `c++` → `cpp`, `py` → `python3`)
 * before comparison.
 */
export function pickAcSubmission(rows: readonly SubmissionRow[], lang?: string): SubmissionRow | null {
  const want = lang ? normalizeLang(lang) : null;
  for (const row of rows) {
    if (row.statusDisplay !== 'Accepted') continue;
    if (want && normalizeLang(row.lang ?? '') !== want) continue;
    return row;
  }
  return null;
}
