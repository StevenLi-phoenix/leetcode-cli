/**
 * Typed error hierarchy for the CLI.
 *
 * Commands throw these; the top-level entrypoint catches them, prints a
 * friendly message (no stack trace for known errors), and exits non-zero.
 */

/** Base class for all errors we raise deliberately and can present cleanly. */
export class CliError extends Error {
  /** Suggested process exit code. */
  readonly exitCode: number;
  /** Optional hint shown on a second line to help the user recover. */
  readonly hint?: string;

  constructor(message: string, options: { exitCode?: number; hint?: string } = {}) {
    super(message);
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? 1;
    this.hint = options.hint;
  }
}

/** The user is not logged in (no credentials in config or env). */
export class AuthError extends CliError {
  constructor(message = 'Not authenticated.', hint = 'Run `leetcode login` to sign in, or set LEETCODE_SESSION / LEETCODE_CSRF_TOKEN.') {
    super(message, { exitCode: 2, hint });
    this.name = 'AuthError';
  }
}

/** A network / HTTP failure talking to LeetCode. */
export class NetworkError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: 3, hint });
    this.name = 'NetworkError';
  }
}

/** LeetCode returned data we could not parse / validate, or a GraphQL error. */
export class ApiError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: 4, hint });
    this.name = 'ApiError';
  }
}

/** The user asked for something that does not exist (problem id, file, etc.). */
export class NotFoundError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: 5, hint });
    this.name = 'NotFoundError';
  }
}

/** Bad arguments / usage the user can fix. */
export class UsageError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: 6, hint });
    this.name = 'UsageError';
  }
}

/** Type guard for our own errors. */
export function isCliError(err: unknown): err is CliError {
  return err instanceof CliError;
}
