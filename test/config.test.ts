import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { AppConfig } from '../src/config.ts';

function tmpConfig(): AppConfig {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-cfg-'));
  return new AppConfig({ cwd: dir });
}

test('defaults are sensible', () => {
  const c = tmpConfig();
  assert.equal(c.site, 'leetcode.com');
  assert.equal(c.lang, 'python3');
  assert.equal(c.endpoints.graphql, 'https://leetcode.com/graphql');
});

test('credentials: store, read, env-first override, clear', () => {
  const c = tmpConfig();
  assert.equal(c.getCredentials(), null);

  c.setCredentials({ session: 's', csrftoken: 't' });
  assert.deepEqual(c.getCredentials(), { session: 's', csrftoken: 't' });
  assert.equal(c.isUsingEnvCredentials(), false);

  process.env.LEETCODE_SESSION = 'envs';
  process.env.LEETCODE_CSRF_TOKEN = 'envt';
  assert.equal(c.isUsingEnvCredentials(), true);
  assert.equal(c.getCredentials()?.session, 'envs');
  delete process.env.LEETCODE_SESSION;
  delete process.env.LEETCODE_CSRF_TOKEN;

  c.clearCredentials();
  assert.equal(c.getCredentials(), null);
});

test('per-site credentials are isolated', () => {
  const c = tmpConfig();
  c.setCredentials({ session: 'us', csrftoken: 'ut' }, 'leetcode.com');
  c.setCredentials({ session: 'cn', csrftoken: 'ct' }, 'leetcode.cn');
  assert.equal(c.getCredentials('leetcode.com')?.session, 'us');
  assert.equal(c.getCredentials('leetcode.cn')?.session, 'cn');
});

test('timer history, problem manifest, snapshots persist', () => {
  const c = tmpConfig();
  c.addTimerRecord({ id: '1', slug: 's', title: 'T', difficulty: 'Easy', plannedMinutes: 20, actualSeconds: 100, completedAt: '2026-01-01', solved: true });
  assert.equal(c.getTimerHistory().length, 1);

  c.rememberProblem({ id: '1', questionId: '1', slug: 's', title: 'T', difficulty: 'Easy', file: '/f', lang: 'python3', site: 'leetcode.com' });
  assert.equal(c.lookupProblem('1')?.slug, 's');
  assert.equal(c.lookupProblem('999'), undefined);

  c.addSnapshot('1', { label: 'v1', file: '/f', lang: 'python3', savedAt: '2026', content: 'x' });
  c.addSnapshot('1', { label: 'v2', file: '/f', lang: 'python3', savedAt: '2026', content: 'y' });
  assert.equal(c.getSnapshots('1').length, 2);
  assert.equal(c.getSnapshots('nope').length, 0);
});

test('LEETCODE_SITE env overrides stored site and endpoints', () => {
  const c = tmpConfig();
  process.env.LEETCODE_SITE = 'leetcode.cn';
  assert.equal(c.site, 'leetcode.cn');
  assert.equal(c.endpoints.graphql, 'https://leetcode.cn/graphql/');
  delete process.env.LEETCODE_SITE;
});
