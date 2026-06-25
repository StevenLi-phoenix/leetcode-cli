import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { resolveSolution } from '../src/lib/solve.ts';
import { AppConfig } from '../src/config.ts';
import { buildSolutionFile } from '../src/lib/files.ts';
import type { LeetCodeClient } from '../src/api/client.ts';

function tmpConfig(): AppConfig {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-solve-'));
  return new AppConfig({ cwd: dir });
}

// A client that throws if touched — proves the header path needs no network.
const noNetworkClient = new Proxy({}, {
  get() {
    throw new Error('client should not be called for a header-tagged file');
  },
}) as unknown as LeetCodeClient;

test('resolveSolution reads a picked file from its header without any API call', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-sol-'));
  const file = path.join(dir, '1.two-sum.py');
  fs.writeFileSync(
    file,
    buildSolutionFile('print(1)', { id: '1', questionId: '1', slug: 'two-sum', lang: 'python3', title: 'Two Sum', site: 'leetcode.com' }),
  );

  const sol = await resolveSolution(noNetworkClient, tmpConfig(), file);
  assert.equal(sol.slug, 'two-sum');
  assert.equal(sol.questionId, '1');
  assert.equal(sol.frontendId, '1');
  assert.equal(sol.lang, 'python3');
  assert.ok(!sol.code.includes('@leetcode'));
  assert.ok(sol.code.includes('print(1)'));
});

test('resolveSolution errors clearly when a non-existent file is given via --file', async () => {
  await assert.rejects(
    () => resolveSolution(noNetworkClient, tmpConfig(), 'whatever', { file: '/no/such/file.py' }),
    /File not found/,
  );
});
