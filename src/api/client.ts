/**
 * Typed LeetCode API client.
 *
 * Wraps the undocumented GraphQL (metadata) and REST (run/submit/check) APIs,
 * injecting the session cookie + CSRF token and adapting to the active site
 * (leetcode.com vs leetcode.cn). All responses are validated with zod.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig, Credentials } from '../config.js';
import { AuthError, NetworkError, ApiError, NotFoundError } from '../lib/errors.js';
import {
  QUESTION_DETAIL,
  problemListQuery,
  dailyQuery,
  userStatusQuery,
  submissionListQuery,
  submissionDetailQuery,
} from './queries.js';
import {
  questionSchema,
  listResponseSchema,
  userStatusSchema,
  dailyResponseSchema,
  checkResultSchema,
  interpretResponseSchema,
  submitResponseSchema,
  allProblemsSchema,
  submissionListSchema,
  submissionDetailsComSchema,
  submissionDetailCnSchema,
} from './schemas.js';
import type { Question, UserStatus, CheckResult, ProblemListItem, SubmissionRow, SubmissionCode } from './schemas.js';
import { pickAcSubmission } from '../lib/submissions.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** LeetCode caps problemsetQuestionList at 100 rows per request. */
const PAGE_LIMIT = 100;

/** LeetCode caps the submission list at 20 rows per request. */
const SUBMISSION_PAGE = 20;

/** Stop scanning a problem's submissions after this many pages (≈500 rows). */
const MAX_SUBMISSION_PAGES = 25;

/** Parse a `Retry-After` header (seconds or HTTP-date) into ms, capped at 30s. */
export function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.min(Math.max(0, secs) * 1000, 30_000);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) return Math.min(Math.max(0, when - Date.now()), 30_000);
  return null;
}

/** Normalise a difficulty label to Title Case (e.g. "EASY" → "Easy"). */
function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

export type DifficultyFilter = 'EASY' | 'MEDIUM' | 'HARD';

/** LeetCode QuestionListFilterInput.status enum. */
export type StatusFilter = 'NOT_STARTED' | 'AC' | 'TRIED';

export interface ListParams {
  difficulty?: DifficultyFilter;
  tags?: string[];
  search?: string;
  category?: string;
  status?: StatusFilter;
  limit?: number;
  skip?: number;
}

export interface ResolvedProblem {
  readonly slug: string;
  readonly frontendId: string;
  readonly title: string;
}

export interface DailyChallenge {
  readonly date?: string;
  readonly slug: string;
  readonly frontendId: string;
  readonly title: string;
  readonly difficulty: string;
}

export interface RunArgs {
  readonly lang: string;
  readonly questionId: string;
  readonly code: string;
  readonly dataInput: string;
}

export interface SubmitArgs {
  readonly lang: string;
  readonly questionId: string;
  readonly code: string;
}

export class LeetCodeClient {
  constructor(private readonly cfg: AppConfig) {}

  // ── Credentials & headers ─────────────────────────────────────────────────

  private requireCreds(): Credentials {
    const creds = this.cfg.getCredentials();
    if (!creds?.session || !creds?.csrftoken) throw new AuthError();
    return creds;
  }

  private cookieHeader(creds: Credentials): string {
    return `LEETCODE_SESSION=${creds.session}; csrftoken=${creds.csrftoken};`;
  }

  private graphqlHeaders(creds: Credentials | null): Record<string, string> {
    const base = this.cfg.endpoints.base;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      origin: base,
      referer: `${base}/`,
    };
    if (this.cfg.site === 'leetcode.cn') headers['accept-language'] = 'zh-CN,zh;q=0.9,en;q=0.8';
    if (creds) {
      headers.cookie = this.cookieHeader(creds);
      headers['x-csrftoken'] = creds.csrftoken;
    }
    return headers;
  }

  private authHeaders(creds: Credentials, referer: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      'x-csrftoken': creds.csrftoken,
      'x-requested-with': 'XMLHttpRequest',
      cookie: this.cookieHeader(creds),
      origin: this.cfg.endpoints.base,
      referer,
    };
  }

  // ── HTTP with automatic 429 / 503 retry ──────────────────────────────────

  /**
   * `fetch` wrapper that transparently retries rate-limit (429) and transient
   * (503) responses with exponential backoff, honouring `Retry-After`. Network
   * errors are left to the caller to wrap. After exhausting retries it returns
   * the last response so the caller's status handling reports it.
   */
  private async fetchRetry(url: string, init?: RequestInit): Promise<Response> {
    const maxRetries = 5;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        const wait = retryAfterMs(res.headers.get('retry-after')) ?? Math.min(1000 * 2 ** attempt, 8000);
        await sleep(wait);
        continue;
      }
      return res;
    }
  }

  // ── GraphQL ───────────────────────────────────────────────────────────────

  async graphql(query: string, variables: Record<string, unknown>, opts: { auth?: boolean } = {}): Promise<unknown> {
    const creds = opts.auth ? this.requireCreds() : this.cfg.getCredentials();
    let res: Response;
    try {
      res = await this.fetchRetry(this.cfg.endpoints.graphql, {
        method: 'POST',
        headers: this.graphqlHeaders(creds),
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      throw new NetworkError(`Failed to reach ${this.cfg.site}: ${(err as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('LeetCode rejected the request (session expired or invalid).');
    }
    if (!res.ok) {
      throw new NetworkError(`${this.cfg.site} returned HTTP ${res.status} ${res.statusText}.`);
    }
    let json: { data?: unknown; errors?: Array<{ message?: string }> };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      throw new ApiError('LeetCode returned a non-JSON response.');
    }
    if (json.errors?.length) {
      throw new ApiError(`GraphQL error: ${json.errors.map((e) => e.message ?? 'unknown').join('; ')}`);
    }
    return json.data;
  }

  /** Fetch full problem detail by slug. */
  async questionDetail(slug: string): Promise<Question> {
    const data = (await this.graphql(QUESTION_DETAIL, { titleSlug: slug })) as { question?: unknown };
    if (!data?.question) {
      throw new NotFoundError(`Problem "${slug}" was not found on ${this.cfg.site}.`);
    }
    return questionSchema.parse(data.question);
  }

  /**
   * List problems with optional filters; returns normalised rows + total.
   *
   * LeetCode caps each request at 100 rows, so a larger `limit` is satisfied by
   * paginating internally (with a small delay between pages to be gentle on the
   * rate limiter).
   */
  async problemList(params: ListParams = {}): Promise<{ total: number; items: ProblemListItem[] }> {
    const want = params.limit ?? 50;
    const startSkip = params.skip ?? 0;
    const items: ProblemListItem[] = [];
    let total = 0;

    for (let skip = startSkip; items.length < want; ) {
      const pageLimit = Math.min(PAGE_LIMIT, want - items.length);
      const page = await this.fetchListPage(params, pageLimit, skip);
      total = page.total;
      if (page.items.length === 0) break;
      items.push(...page.items);
      skip += page.items.length;
      if (skip >= total) break;
      if (items.length < want) await sleep(150); // courtesy delay between pages
    }
    return { total, items: items.slice(0, want) };
  }

  /** Fetch a single page (≤100) of the problem list. */
  private async fetchListPage(
    params: ListParams,
    limit: number,
    skip: number,
  ): Promise<{ total: number; items: ProblemListItem[] }> {
    const filters: Record<string, unknown> = {};
    if (params.difficulty) filters.difficulty = params.difficulty;
    if (params.tags?.length) filters.tags = params.tags;
    if (params.search) filters.searchKeywords = params.search;
    if (params.status) filters.status = params.status;
    const variables = { categorySlug: params.category ?? '', limit, skip, filters };
    const data = await this.graphql(problemListQuery(this.cfg.site), variables);
    const parsed = listResponseSchema.parse(data);
    const cn = this.cfg.site === 'leetcode.cn';
    const rows = parsed.problemsetQuestionList?.questions ?? [];
    const items: ProblemListItem[] = rows.map((row) => ({
      frontendId: row.questionFrontendId ?? row.frontendQuestionId ?? '',
      title: (cn ? row.titleCn ?? row.title : row.title) ?? row.title,
      titleSlug: row.titleSlug,
      difficulty: titleCase(row.difficulty),
      paidOnly: row.isPaidOnly ?? row.paidOnly ?? false,
      status: row.status ?? null,
      // .com reports acRate on a 0–100 scale; .cn reports a 0–1 fraction.
      // Guard the cn rescale so a future scale change can't produce e.g. 5500%.
      acRate: row.acRate == null ? null : cn && row.acRate <= 1 ? row.acRate * 100 : row.acRate,
      tags: (row.topicTags ?? []).map((t) => t.slug ?? '').filter((s): s is string => Boolean(s)),
    }));
    return { total: parsed.problemsetQuestionList?.total ?? items.length, items };
  }

  /** Today's daily challenge. */
  async daily(): Promise<DailyChallenge> {
    const data = await this.graphql(dailyQuery(this.cfg.site), {});
    const parsed = dailyResponseSchema.parse(data);
    const com = parsed.activeDailyCodingChallengeQuestion;
    const cnRecord = parsed.todayRecord?.[0];
    const ref = com?.question ?? cnRecord?.question;
    const date = com?.date ?? cnRecord?.date ?? undefined;
    if (!ref) throw new ApiError('No daily challenge was returned.');
    return {
      date: date ?? undefined,
      slug: ref.titleSlug,
      frontendId: ref.questionFrontendId,
      title: ref.title,
      difficulty: ref.difficulty,
    };
  }

  /** Signed-in user status (requires auth). */
  async userStatus(): Promise<UserStatus> {
    const data = (await this.graphql(userStatusQuery(this.cfg.site), {}, { auth: true })) as { userStatus?: unknown };
    if (!data?.userStatus) throw new ApiError('Could not read user status.');
    return userStatusSchema.parse(data.userStatus);
  }

  // ── Submissions (auth) ────────────────────────────────────────────────────

  /**
   * One page (≤20) of the signed-in user's submissions for a problem, newest
   * first. `.com` pages by `offset`; `.cn` requires `questionSlug` and pages by
   * the `lastKey` cursor (pass the previous page's `lastKey` back in).
   */
  async submissionsPage(
    slug: string,
    offset: number,
    lastKey: string | null,
  ): Promise<{ hasNext: boolean; lastKey: string | null; submissions: SubmissionRow[] }> {
    const cn = this.cfg.site === 'leetcode.cn';
    const variables: Record<string, unknown> = cn
      ? { offset, limit: SUBMISSION_PAGE, lastKey, questionSlug: slug }
      : { offset, limit: SUBMISSION_PAGE, slug };
    const data = await this.graphql(submissionListQuery(this.cfg.site), variables, { auth: true });
    const list = submissionListSchema.parse(data).submissionList;
    return { hasNext: list?.hasNext ?? false, lastKey: list?.lastKey ?? null, submissions: list?.submissions ?? [] };
  }

  /** Walk a problem's submission pages (newest first) up to the page cap. */
  private async *eachSubmissionPage(slug: string): AsyncGenerator<SubmissionRow[]> {
    let offset = 0;
    let lastKey: string | null = null;
    for (let page = 0; page < MAX_SUBMISSION_PAGES; page++) {
      const { hasNext, lastKey: nextKey, submissions } = await this.submissionsPage(slug, offset, lastKey);
      yield submissions;
      if (!hasNext || submissions.length === 0) break;
      offset += submissions.length;
      lastKey = nextKey;
      await sleep(150); // courtesy delay between pages
    }
  }

  /**
   * The most recent Accepted submission for a problem (optionally restricted to
   * a language), or null if none.
   */
  async latestAcSubmission(slug: string, opts: { lang?: string } = {}): Promise<SubmissionRow | null> {
    for await (const submissions of this.eachSubmissionPage(slug)) {
      const hit = pickAcSubmission(submissions, opts.lang);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Best Accepted submission for a problem under a *preference*: return the most
   * recent submission in `preferLang` if one exists, otherwise fall back to the
   * most recent Accepted submission in any language. Null if there is no AC at
   * all. Used by `pull` so each problem yields exactly one file (your C++ if you
   * have it, any accepted language if you don't).
   */
  async bestAcSubmission(slug: string, preferLang?: string): Promise<SubmissionRow | null> {
    let fallback: SubmissionRow | null = null;
    for await (const submissions of this.eachSubmissionPage(slug)) {
      const preferred = pickAcSubmission(submissions, preferLang);
      if (preferred) return preferred;
      // Newest-first, so the first AC we ever see is the latest in any language.
      if (!fallback) fallback = pickAcSubmission(submissions);
    }
    return fallback;
  }

  /** One fetch of a submission's detail; null when LeetCode returns no detail. */
  private async fetchSubmissionDetail(id: string): Promise<SubmissionCode | null> {
    if (this.cfg.site === 'leetcode.cn') {
      const data = await this.graphql(submissionDetailQuery('leetcode.cn'), { id }, { auth: true });
      const d = submissionDetailCnSchema.parse(data).submissionDetail;
      return d ? { code: d.code, langSlug: d.lang ?? null, questionId: d.question?.questionId ?? null, titleSlug: d.question?.titleSlug ?? null } : null;
    }
    const data = await this.graphql(submissionDetailQuery('leetcode.com'), { id: Number(id) }, { auth: true });
    const d = submissionDetailsComSchema.parse(data).submissionDetails;
    return d ? { code: d.code, langSlug: d.lang?.name ?? null, questionId: d.question?.questionId ?? null, titleSlug: d.question?.titleSlug ?? null } : null;
  }

  /**
   * Fetch the source code (+ lang/questionId) of a submission by id. Under rapid
   * batch use LeetCode soft-throttles by returning an HTTP-200 response with a
   * `null` detail (so the 429/503 retry doesn't fire); we retry that here with
   * backoff before giving up.
   */
  async submissionCode(id: string): Promise<SubmissionCode> {
    const maxRetries = 4;
    for (let attempt = 0; ; attempt++) {
      const detail = await this.fetchSubmissionDetail(id);
      if (detail) return detail;
      if (attempt >= maxRetries) {
        throw new NotFoundError(
          `Submission ${id} was not found on ${this.cfg.site}.`,
          'LeetCode may be throttling — retry in a moment.',
        );
      }
      await sleep(Math.min(800 * 2 ** attempt, 5000));
    }
  }

  // ── REST: run / submit / check ────────────────────────────────────────────

  private async restPost(url: string, referer: string, body: Record<string, unknown>, attempt = 0): Promise<unknown> {
    const creds = this.requireCreds();
    let res: Response;
    try {
      res = await this.fetchRetry(url, { method: 'POST', headers: this.authHeaders(creds, referer), body: JSON.stringify(body) });
    } catch (err) {
      throw new NetworkError(`Request to ${this.cfg.site} failed: ${(err as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('LeetCode rejected the request (session expired or invalid).');
    }
    if (!res.ok) {
      throw new NetworkError(`${this.cfg.site} returned HTTP ${res.status} ${res.statusText}.`);
    }
    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError('LeetCode returned a non-JSON response (are you logged in?).');
    }
    const err = typeof json.error === 'string' ? json.error : '';
    if (err && /too soon/i.test(err) && attempt < 5) {
      await sleep(1000 * (attempt + 1));
      return this.restPost(url, referer, body, attempt + 1);
    }
    return json;
  }

  /** Run code against the given input; returns the interpret ids to poll. */
  async interpret(slug: string, args: RunArgs): Promise<{ interpretId: string; expectedId?: string }> {
    const url = this.cfg.endpoints.interpret.replace('{slug}', slug);
    const referer = `${this.cfg.endpoints.base}/problems/${slug}/`;
    const data = await this.restPost(url, referer, {
      lang: args.lang,
      question_id: args.questionId,
      typed_code: args.code,
      data_input: args.dataInput,
      test_mode: false,
    });
    const parsed = interpretResponseSchema.parse(data);
    if (parsed.error) throw new ApiError(parsed.error);
    if (!parsed.interpret_id) {
      throw new ApiError('LeetCode did not return a run id.', 'Check that your session is valid (`leetcode whoami`).');
    }
    return { interpretId: parsed.interpret_id, expectedId: parsed.interpret_expected_id };
  }

  /** Submit a solution; returns the submission id to poll. */
  async submit(slug: string, args: SubmitArgs): Promise<number> {
    const url = this.cfg.endpoints.submit.replace('{slug}', slug);
    const referer = `${this.cfg.endpoints.base}/problems/${slug}/`;
    const data = await this.restPost(url, referer, {
      lang: args.lang,
      question_id: args.questionId,
      typed_code: args.code,
      judge_type: 'large',
      test_mode: false,
    });
    const parsed = submitResponseSchema.parse(data);
    if (parsed.error) throw new ApiError(parsed.error);
    const id = parsed.submission_id;
    if (id === undefined || id === 0 || id === '0') {
      throw new ApiError('LeetCode did not accept the submission.', 'Check that your session is valid (`leetcode whoami`).');
    }
    return Number(id);
  }

  /** One check poll. */
  async check(id: string): Promise<CheckResult> {
    const url = this.cfg.endpoints.check.replace('{id}', id);
    const creds = this.requireCreds();
    let res: Response;
    try {
      res = await this.fetchRetry(url, { headers: this.authHeaders(creds, `${this.cfg.endpoints.base}/`) });
    } catch (err) {
      throw new NetworkError(`Request to ${this.cfg.site} failed: ${(err as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) throw new AuthError();
    if (!res.ok) throw new NetworkError(`${this.cfg.site} returned HTTP ${res.status} ${res.statusText}.`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ApiError('LeetCode returned a non-JSON response (are you logged in?).');
    }
    return checkResultSchema.parse(body);
  }

  /** Poll a run/submission until it reaches a terminal state. */
  async pollCheck(id: string, onState?: (state: string) => void): Promise<CheckResult> {
    const maxAttempts = 40;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.check(id);
      onState?.(result.state);
      if (result.state === 'SUCCESS' || result.state === 'FAILURE') return result;
      await sleep(Math.min(500 * 2 ** attempt, 2500));
    }
    throw new ApiError('Timed out waiting for the judge result.');
  }

  // ── id → slug resolution (cached REST problem index) ──────────────────────

  private problemsCachePath(): string {
    return path.join(path.dirname(this.cfg.path), `problems-${this.cfg.site}.json`);
  }

  /** All problems keyed by frontend id, cached on disk for 24h. */
  async allProblems(): Promise<Map<string, ResolvedProblem>> {
    const cacheFile = this.problemsCachePath();
    try {
      const stat = fs.statSync(cacheFile);
      if (Date.now() - stat.mtimeMs < 24 * 3600 * 1000) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Array<[string, ResolvedProblem]>;
        return new Map(cached);
      }
    } catch {
      /* no/stale cache — fall through to fetch */
    }
    const url = `${this.cfg.endpoints.base}/api/problems/all/`;
    const creds = this.cfg.getCredentials();
    const headers: Record<string, string> = { 'user-agent': USER_AGENT };
    if (creds) headers.cookie = this.cookieHeader(creds);
    let res: Response;
    try {
      res = await this.fetchRetry(url, { headers });
    } catch (err) {
      throw new NetworkError(`Failed to fetch the problem index: ${(err as Error).message}`);
    }
    if (!res.ok) throw new NetworkError(`${this.cfg.site} returned HTTP ${res.status} fetching the problem index.`);
    const data = allProblemsSchema.parse(await res.json());
    const map = new Map<string, ResolvedProblem>();
    for (const p of data.stat_status_pairs) {
      const frontendId = String(p.stat.frontend_question_id);
      map.set(frontendId, { slug: p.stat.question__title_slug, frontendId, title: p.stat.question__title });
    }
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify([...map.entries()]));
    } catch {
      /* cache write best-effort */
    }
    return map;
  }

  /** Resolve a frontend id or slug to a titleSlug. */
  async resolveSlug(identifier: string): Promise<string> {
    const id = identifier.trim();
    if (/^\d+$/.test(id)) {
      const fromManifest = this.cfg.lookupProblem(id);
      if (fromManifest) return fromManifest.slug;
      const map = await this.allProblems();
      const found = map.get(id);
      if (!found) throw new NotFoundError(`No problem with id ${id} on ${this.cfg.site}.`);
      return found.slug;
    }
    return id.toLowerCase().replace(/\s+/g, '-');
  }
}
