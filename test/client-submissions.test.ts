import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { LeetCodeClient } from '../src/api/client.ts';
import { AppConfig } from '../src/config.ts';
import type { Site } from '../src/config.ts';

/** A client with stored credentials (submission queries require auth). */
function authedClient(site: Site = 'leetcode.com'): LeetCodeClient {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-sub-'));
  const cfg = new AppConfig({ cwd: dir });
  cfg.site = site;
  cfg.setCredentials({ session: 's', csrftoken: 't' }, site);
  return new LeetCodeClient(cfg);
}

/** Stub global fetch with a queue of JSON `data` payloads (one per call). */
function stubFetch(pages: unknown[]): { restore: () => void; calls: () => number } {
  const orig = globalThis.fetch;
  let i = 0;
  globalThis.fetch = (async () => {
    const data = pages[Math.min(i, pages.length - 1)];
    i++;
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = orig; }, calls: () => i };
}

test('latestAcSubmission pages until it finds the most recent Accepted', async () => {
  const client = authedClient('leetcode.com');
  const stub = stubFetch([
    { submissionList: { hasNext: true, submissions: [{ id: '3', statusDisplay: 'Wrong Answer', lang: 'cpp' }] } },
    { submissionList: { hasNext: false, submissions: [{ id: '2', statusDisplay: 'Accepted', lang: 'cpp' }] } },
  ]);
  try {
    const ac = await client.latestAcSubmission('two-sum');
    assert.equal(ac?.id, '2');
    assert.equal(stub.calls(), 2); // had to fetch the second page
  } finally {
    stub.restore();
  }
});

test('latestAcSubmission returns null when there is no accepted submission', async () => {
  const client = authedClient('leetcode.com');
  const stub = stubFetch([{ submissionList: { hasNext: false, submissions: [{ id: '1', statusDisplay: 'Wrong Answer', lang: 'cpp' }] } }]);
  try {
    assert.equal(await client.latestAcSubmission('two-sum'), null);
  } finally {
    stub.restore();
  }
});

test('bestAcSubmission returns the preferred language even if an older AC', async () => {
  const client = authedClient('leetcode.com');
  // newest-first: latest AC is python3 (id 5); cpp AC is older (id 3, page 2).
  const stub = stubFetch([
    { submissionList: { hasNext: true, submissions: [{ id: '5', statusDisplay: 'Accepted', lang: 'python3' }] } },
    { submissionList: { hasNext: false, submissions: [{ id: '3', statusDisplay: 'Accepted', lang: 'cpp' }] } },
  ]);
  try {
    const got = await client.bestAcSubmission('two-sum', 'cpp');
    assert.equal(got?.id, '3'); // prefers cpp over the newer python3
    assert.equal(got?.lang, 'cpp');
  } finally {
    stub.restore();
  }
});

test('bestAcSubmission falls back to the latest AC when preferred lang is absent', async () => {
  const client = authedClient('leetcode.com');
  const stub = stubFetch([
    { submissionList: { hasNext: false, submissions: [
      { id: '9', statusDisplay: 'Accepted', lang: 'python3' },
      { id: '8', statusDisplay: 'Accepted', lang: 'java' },
    ] } },
  ]);
  try {
    const got = await client.bestAcSubmission('two-sum', 'cpp');
    assert.equal(got?.id, '9'); // no cpp → most recent AC overall
  } finally {
    stub.restore();
  }
});

test('bestAcSubmission returns null when there is no AC at all', async () => {
  const client = authedClient('leetcode.com');
  const stub = stubFetch([{ submissionList: { hasNext: false, submissions: [{ id: '1', statusDisplay: 'Wrong Answer', lang: 'cpp' }] } }]);
  try {
    assert.equal(await client.bestAcSubmission('two-sum', 'cpp'), null);
  } finally {
    stub.restore();
  }
});

test('submissionCode (.com) reads code from the plural field + lang object', async () => {
  const client = authedClient('leetcode.com');
  const stub = stubFetch([{ submissionDetails: { code: 'class Solution {};', lang: { name: 'cpp' }, question: { questionId: '1', titleSlug: 'two-sum' } } }]);
  try {
    const got = await client.submissionCode('123');
    assert.equal(got.code, 'class Solution {};');
    assert.equal(got.langSlug, 'cpp');
    assert.equal(got.questionId, '1');
  } finally {
    stub.restore();
  }
});

test('submissionCode retries when LeetCode soft-throttles with a null detail', async () => {
  const client = authedClient('leetcode.com');
  // First two calls return a 200 with null detail (the soft-throttle), then real data.
  const stub = stubFetch([
    { submissionDetails: null },
    { submissionDetails: null },
    { submissionDetails: { code: 'ok', lang: { name: 'cpp' }, question: { questionId: '1', titleSlug: 'two-sum' } } },
  ]);
  try {
    const got = await client.submissionCode('123');
    assert.equal(got.code, 'ok');
    assert.equal(stub.calls(), 3); // two null responses retried, third succeeded
  } finally {
    stub.restore();
  }
});

test('submissionCode (.cn) reads code from the singular field + lang string', async () => {
  const client = authedClient('leetcode.cn');
  const stub = stubFetch([{ submissionDetail: { code: 'print(1)', lang: 'python3', question: { questionId: '1', titleSlug: 'two-sum' } } }]);
  try {
    const got = await client.submissionCode('123');
    assert.equal(got.code, 'print(1)');
    assert.equal(got.langSlug, 'python3');
    assert.equal(got.questionId, '1');
  } finally {
    stub.restore();
  }
});
