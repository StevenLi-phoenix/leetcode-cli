/**
 * Persistent configuration and credential storage, backed by `conf`.
 *
 * One JSON store under the OS config dir holds: the active site, default
 * language / workdir / editor, per-site credentials, the timer history and
 * defaults, a problem manifest (so `test`/`submit` can find a picked file by
 * id), and local snapshots.
 *
 * Credentials are resolved env-first: LEETCODE_SESSION / LEETCODE_CSRF_TOKEN
 * (and optional LEETCODE_SITE) override whatever is stored, so the tool works
 * in CI or shells without a prior `login`.
 */
import os from 'node:os';
import path from 'node:path';
import Conf from 'conf';
import { UsageError } from './lib/errors.js';

export type Site = 'leetcode.com' | 'leetcode.cn';

/** Validate a site string, throwing a friendly error on bad input. */
export function parseSite(value: string): Site {
  if (value === 'leetcode.com' || value === 'leetcode.cn') return value;
  throw new UsageError(`Invalid site "${value}".`, 'Use leetcode.com or leetcode.cn.');
}

export interface SiteEndpoints {
  readonly name: Site;
  readonly base: string;
  readonly graphql: string;
  /** REST template for running code; `{slug}` is substituted. */
  readonly interpret: string;
  /** REST template for submitting code; `{slug}` is substituted. */
  readonly submit: string;
  /** REST template for polling a run/submission result; `{id}` is substituted. */
  readonly check: string;
}

export const SITES: Record<Site, SiteEndpoints> = {
  'leetcode.com': {
    name: 'leetcode.com',
    base: 'https://leetcode.com',
    // .com expects the POST at /graphql (no trailing slash); a trailing slash
    // can trigger a redirect that drops the POST body.
    graphql: 'https://leetcode.com/graphql',
    interpret: 'https://leetcode.com/problems/{slug}/interpret_solution/',
    submit: 'https://leetcode.com/problems/{slug}/submit/',
    check: 'https://leetcode.com/submissions/detail/{id}/check/',
  },
  'leetcode.cn': {
    name: 'leetcode.cn',
    base: 'https://leetcode.cn',
    graphql: 'https://leetcode.cn/graphql/',
    interpret: 'https://leetcode.cn/problems/{slug}/interpret_solution/',
    submit: 'https://leetcode.cn/problems/{slug}/submit/',
    check: 'https://leetcode.cn/submissions/detail/{id}/check/',
  },
};

export interface Credentials {
  readonly session: string;
  readonly csrftoken: string;
  readonly username?: string;
}

export interface TimerDefaults {
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface TimerRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: string;
  readonly plannedMinutes: number;
  readonly actualSeconds: number;
  readonly completedAt: string;
  readonly solved: boolean;
}

export interface ProblemManifestEntry {
  readonly id: string;
  readonly questionId: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: string;
  readonly file: string;
  readonly lang: string;
  readonly site: Site;
}

export interface SnapshotEntry {
  readonly label: string;
  readonly file: string;
  readonly lang: string;
  readonly savedAt: string;
  readonly content: string;
}

interface StoreShape {
  site: Site;
  lang: string;
  workdir: string;
  editor: string;
  credentials: Partial<Record<Site, Credentials>>;
  timer: {
    defaults: TimerDefaults;
    history: TimerRecord[];
  };
  problems: Record<string, ProblemManifestEntry>;
  snapshots: Record<string, SnapshotEntry[]>;
}

const DEFAULTS: StoreShape = {
  site: 'leetcode.com',
  lang: 'python3',
  workdir: path.join(os.homedir(), 'leetcode'),
  editor: '',
  credentials: {},
  timer: {
    defaults: { Easy: 20, Medium: 40, Hard: 60 },
    history: [],
  },
  problems: {},
  snapshots: {},
};

export class AppConfig {
  private readonly store: Conf<StoreShape>;

  constructor(opts: { cwd?: string } = {}) {
    this.store = new Conf<StoreShape>({
      projectName: 'leetcode-cli',
      cwd: opts.cwd,
      defaults: DEFAULTS,
    });
  }

  /** Absolute path to the underlying JSON config file. */
  get path(): string {
    return this.store.path;
  }

  // ── Simple settings ──────────────────────────────────────────────────────

  get site(): Site {
    const env = process.env.LEETCODE_SITE;
    if (env === 'leetcode.com' || env === 'leetcode.cn') return env;
    return this.store.get('site');
  }

  set site(value: Site) {
    this.store.set('site', value);
  }

  get endpoints(): SiteEndpoints {
    return SITES[this.site];
  }

  get lang(): string {
    return process.env.LEETCODE_LANG ?? this.store.get('lang');
  }

  set lang(value: string) {
    this.store.set('lang', value);
  }

  get workdir(): string {
    return process.env.LEETCODE_WORKDIR ?? this.store.get('workdir');
  }

  set workdir(value: string) {
    this.store.set('workdir', value);
  }

  get editor(): string | undefined {
    return process.env.LEETCODE_EDITOR ?? this.store.get('editor') ?? process.env.EDITOR;
  }

  set editor(value: string) {
    this.store.set('editor', value);
  }

  // ── Credentials (env-first) ──────────────────────────────────────────────

  getCredentials(site: Site = this.site): Credentials | null {
    const envSession = process.env.LEETCODE_SESSION;
    const envCsrf = process.env.LEETCODE_CSRF_TOKEN;
    if (envSession && envCsrf) {
      return { session: envSession, csrftoken: envCsrf };
    }
    const stored = this.store.get('credentials')[site];
    return stored ?? null;
  }

  setCredentials(creds: Credentials, site: Site = this.site): void {
    const all = { ...this.store.get('credentials') };
    all[site] = creds;
    this.store.set('credentials', all);
  }

  clearCredentials(site: Site = this.site): void {
    const all = { ...this.store.get('credentials') };
    delete all[site];
    this.store.set('credentials', all);
  }

  /** True when credentials come from the environment rather than the store. */
  isUsingEnvCredentials(): boolean {
    return Boolean(process.env.LEETCODE_SESSION && process.env.LEETCODE_CSRF_TOKEN);
  }

  // ── Timer ────────────────────────────────────────────────────────────────

  getTimerDefaults(): TimerDefaults {
    return this.store.get('timer').defaults;
  }

  setTimerDefault(difficulty: keyof TimerDefaults, minutes: number): void {
    const timer = this.store.get('timer');
    this.store.set('timer', { ...timer, defaults: { ...timer.defaults, [difficulty]: minutes } });
  }

  addTimerRecord(record: TimerRecord): void {
    const timer = this.store.get('timer');
    this.store.set('timer', { ...timer, history: [...timer.history, record] });
  }

  getTimerHistory(): readonly TimerRecord[] {
    return this.store.get('timer').history;
  }

  // ── Problem manifest ─────────────────────────────────────────────────────

  rememberProblem(entry: ProblemManifestEntry): void {
    const problems = { ...this.store.get('problems') };
    problems[entry.id] = entry;
    this.store.set('problems', problems);
  }

  lookupProblem(id: string): ProblemManifestEntry | undefined {
    return this.store.get('problems')[id];
  }

  // ── Snapshots ────────────────────────────────────────────────────────────

  getSnapshots(key: string): readonly SnapshotEntry[] {
    return this.store.get('snapshots')[key] ?? [];
  }

  addSnapshot(key: string, entry: SnapshotEntry): void {
    const all = { ...this.store.get('snapshots') };
    all[key] = [...(all[key] ?? []), entry];
    this.store.set('snapshots', all);
  }

  setSnapshots(key: string, entries: SnapshotEntry[]): void {
    const all = { ...this.store.get('snapshots') };
    all[key] = entries;
    this.store.set('snapshots', all);
  }
}

/** Shared singleton used by all commands. */
export const config = new AppConfig();
