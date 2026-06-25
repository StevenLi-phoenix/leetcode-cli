import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { AppConfig } from '../src/config.ts';
import { writeSolution } from '../src/commands/pick.ts';
import { pickAcSubmission } from '../src/lib/submissions.ts';
import { parseHeader } from '../src/lib/files.ts';
import type { SubmissionRow } from '../src/api/schemas.ts';

function tmpConfig(): AppConfig {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-pull-'));
  const c = new AppConfig({ cwd: dir });
  c.workdir = dir;
  return c;
}

const input = { frontendId: '1', questionId: '1', slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' };

test('writeSolution writes problems/{id}.{slug}.{ext} with an @leetcode header', () => {
  const c = tmpConfig();
  const res = writeSolution(c, input, 'cpp', 'class Solution {};', {});
  assert.equal(res.created, true);
  assert.equal(path.basename(res.file), '1.two-sum.cpp');
  assert.equal(path.basename(path.dirname(res.file)), 'problems');

  const content = fs.readFileSync(res.file, 'utf8');
  const header = parseHeader(content);
  assert.equal(header?.id, '1');
  assert.equal(header?.questionId, '1');
  assert.equal(header?.slug, 'two-sum');
  assert.equal(header?.lang, 'cpp');
  assert.ok(content.includes('class Solution {};'));

  // The manifest now resolves this problem to the written file.
  assert.equal(c.lookupProblem('1')?.file, res.file);
});

test('writeSolution does not overwrite without force, but does with force', () => {
  const c = tmpConfig();
  const first = writeSolution(c, input, 'cpp', 'ORIGINAL', {});
  assert.equal(first.created, true);

  const second = writeSolution(c, input, 'cpp', 'CHANGED', {});
  assert.equal(second.created, false);
  assert.ok(fs.readFileSync(first.file, 'utf8').includes('ORIGINAL'));

  const forced = writeSolution(c, input, 'cpp', 'CHANGED', { force: true });
  assert.equal(forced.created, true);
  assert.ok(fs.readFileSync(forced.file, 'utf8').includes('CHANGED'));
});

const rows: SubmissionRow[] = [
  { id: '30', statusDisplay: 'Wrong Answer', lang: 'cpp', timestamp: 300 },
  { id: '29', statusDisplay: 'Accepted', lang: 'python3', timestamp: 290 },
  { id: '28', statusDisplay: 'Accepted', lang: 'cpp', timestamp: 280 },
];

test('pickAcSubmission returns the most recent Accepted row (list is newest-first)', () => {
  assert.equal(pickAcSubmission(rows)?.id, '29');
});

test('pickAcSubmission filters by (normalised) language', () => {
  assert.equal(pickAcSubmission(rows, 'cpp')?.id, '28');
  assert.equal(pickAcSubmission(rows, 'c++')?.id, '28'); // alias normalised
  assert.equal(pickAcSubmission(rows, 'py')?.id, '29'); // py → python3
});

test('pickAcSubmission returns null when nothing matches', () => {
  assert.equal(pickAcSubmission([{ id: '1', statusDisplay: 'Wrong Answer', lang: 'cpp' }]), null);
  assert.equal(pickAcSubmission(rows, 'java'), null);
});
