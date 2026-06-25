import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusName, isAccepted, renderRunResult, renderSubmitResult } from '../src/lib/judge.ts';
import type { CheckResult } from '../src/api/schemas.ts';
import { stripAnsi } from './_helpers.ts';

const r = (o: Partial<CheckResult>): CheckResult => ({ state: 'SUCCESS', ...o }) as CheckResult;

test('statusName falls back from code', () => {
  assert.equal(statusName(r({ status_code: 11 })), 'Wrong Answer');
  assert.equal(statusName(r({ status_msg: 'Accepted' })), 'Accepted');
  assert.equal(statusName(r({})), 'Unknown');
});

test('isAccepted distinguishes run vs submit', () => {
  assert.equal(isAccepted(r({ status_code: 10, correct_answer: true }), 'run'), true);
  assert.equal(isAccepted(r({ status_code: 10, correct_answer: false }), 'run'), false);
  assert.equal(isAccepted(r({ status_code: 10 }), 'run'), false); // ungraded custom run is not "accepted"
  assert.equal(isAccepted(r({ status_code: 10 }), 'submit'), true);
  assert.equal(isAccepted(r({ status_code: 11 }), 'submit'), false);
});

test('renderRunResult: ungraded custom run shows Finished, not Accepted', () => {
  const out = stripAnsi(renderRunResult(r({ status_code: 10, code_answer: ['42'] })));
  assert.ok(out.includes('Finished'), out);
  assert.ok(!out.includes('Accepted'), out);
  assert.ok(out.includes('42'), out);
});

test('renderSubmitResult: accepted with stats', () => {
  const out = stripAnsi(
    renderSubmitResult(r({ status_code: 10, total_correct: 5, total_testcases: 5, status_runtime: '10 ms', status_memory: '14 MB', runtime_percentile: 90.5 })),
  );
  assert.ok(out.includes('Accepted'));
  assert.ok(out.includes('5/5'));
  assert.ok(out.includes('10 ms'));
  assert.ok(out.includes('90.5%'));
});

test('renderSubmitResult: wrong answer shows expected', () => {
  const out = stripAnsi(
    renderSubmitResult(r({ status_code: 11, total_correct: 2, total_testcases: 5, last_testcase: '1\n2', expected_output: '3', code_output: ['4'] })),
  );
  assert.ok(out.includes('Wrong Answer'));
  assert.ok(out.includes('2/5'));
  assert.ok(out.includes('Expected output: 3'));
});

test('renderSubmitResult: compile error body', () => {
  const out = stripAnsi(renderSubmitResult(r({ status_code: 20, full_compile_error: 'boom' })));
  assert.ok(out.includes('Compile Error'));
  assert.ok(out.includes('boom'));
});

test('renderSubmitResult: runtime error body', () => {
  const out = stripAnsi(renderSubmitResult(r({ status_code: 15, full_runtime_error: 'segfault', last_testcase: '7' })));
  assert.ok(out.includes('Runtime Error'));
  assert.ok(out.includes('segfault'));
});

test('renderRunResult shows output and expected', () => {
  const out = stripAnsi(renderRunResult(r({ status_code: 10, correct_answer: true, code_answer: ['[0,1]'], status_runtime: '5 ms' }), ['[0,1]']));
  assert.ok(out.includes('Accepted'));
  assert.ok(out.includes('[0,1]'));
});
