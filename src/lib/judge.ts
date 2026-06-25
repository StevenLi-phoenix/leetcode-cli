/**
 * Format judge results (the REST `check` response) for the terminal.
 * `renderRunResult` is for `test` (interpret) runs; `renderSubmitResult` for
 * `submit`. Both branch on the LeetCode status_code.
 */
import type { CheckResult } from '../api/schemas.js';
import { STATUS_CODES } from '../api/schemas.js';
import { verdict, chalk } from './format.js';

export function statusName(result: CheckResult): string {
  if (result.status_msg) return result.status_msg;
  if (typeof result.status_code === 'number') return STATUS_CODES[result.status_code] ?? 'Unknown';
  return 'Unknown';
}

/**
 * True when the result counts as a pass.
 * For a run, that means the judge graded it correct (`correct_answer === true`).
 * Custom runs (`-c`) are ungraded — `correct_answer` is null — so they are
 * NOT "accepted"; they merely executed (see renderRunResult's "Finished").
 */
export function isAccepted(result: CheckResult, mode: 'run' | 'submit'): boolean {
  if (result.status_code !== 10) return false;
  return mode === 'submit' ? true : result.correct_answer === true;
}

function errorBlock(result: CheckResult): string | null {
  if (result.status_code === 20) {
    return `${verdict('Compile Error')}\n${chalk.red(result.full_compile_error ?? result.compile_error ?? '')}`;
  }
  if (result.status_code === 15 || result.status_code === 16) {
    const body = chalk.red(result.full_runtime_error ?? result.runtime_error ?? statusName(result));
    const input = result.last_testcase ? `\n${chalk.dim('Last input: ')}${result.last_testcase.replace(/\n/g, ' ')}` : '';
    return `${verdict('Runtime Error')}\n${body}${input}`;
  }
  return null;
}

/** Render a `test`/run result. `expected` may come from a second poll. */
export function renderRunResult(result: CheckResult, expected?: readonly string[]): string {
  const err = errorBlock(result);
  if (err) return err;

  // correct_answer is true/false for example cases, but null for a custom (-c)
  // run, which LeetCode executes without grading.
  let badge: string;
  if (result.correct_answer === true) badge = verdict('Accepted');
  else if (result.correct_answer === false) badge = verdict('Wrong Answer');
  else badge = chalk.bgCyan.black(' Finished ');
  const lines: string[] = [badge];
  if (result.status_runtime) lines.push(`${chalk.dim('Runtime: ')}${result.status_runtime}`);

  const yours = result.code_answer ?? [];
  const exp = expected ?? result.expected_code_answer ?? [];
  if (yours.length) lines.push(`${chalk.dim('Output:   ')}${yours.join(' | ')}`);
  if (exp.length) lines.push(`${chalk.dim('Expected: ')}${exp.join(' | ')}`);

  const stdout = (result.code_output ?? []).filter(Boolean);
  if (stdout.length) {
    lines.push(chalk.dim('Stdout:'));
    lines.push(stdout.join('\n'));
  }
  return lines.join('\n');
}

/** Render a `submit` result. */
export function renderSubmitResult(result: CheckResult): string {
  const err = errorBlock(result);
  if (err) return err;

  const accepted = isAccepted(result, 'submit');
  const lines: string[] = [accepted ? verdict('Accepted') : verdict(statusName(result))];

  if (typeof result.total_correct === 'number' && typeof result.total_testcases === 'number') {
    lines.push(`${chalk.dim('Cases:    ')}${result.total_correct}/${result.total_testcases}`);
  }
  if (result.status_runtime) {
    const pct = typeof result.runtime_percentile === 'number' ? chalk.dim(` (beats ${result.runtime_percentile.toFixed(1)}%)`) : '';
    lines.push(`${chalk.dim('Runtime:  ')}${result.status_runtime}${pct}`);
  }
  if (result.status_memory) {
    const pct = typeof result.memory_percentile === 'number' ? chalk.dim(` (beats ${result.memory_percentile.toFixed(1)}%)`) : '';
    lines.push(`${chalk.dim('Memory:   ')}${result.status_memory}${pct}`);
  }
  if (!accepted) {
    if (result.last_testcase) lines.push(`${chalk.dim('Last input:      ')}${result.last_testcase.replace(/\n/g, ' ')}`);
    const out = (result.code_output ?? []).filter(Boolean);
    if (out.length) lines.push(`${chalk.dim('Your output:     ')}${out.join(' ')}`);
    if (result.expected_output) lines.push(`${chalk.dim('Expected output: ')}${result.expected_output}`);
  }
  return lines.join('\n');
}
