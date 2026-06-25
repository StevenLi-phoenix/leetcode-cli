import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { retryAfterMs, LeetCodeClient } from '../src/api/client.ts';
import { AppConfig } from '../src/config.ts';

test('retryAfterMs parses seconds, HTTP-date, and junk', () => {
  assert.equal(retryAfterMs('2'), 2000);
  assert.equal(retryAfterMs('0'), 0);
  assert.equal(retryAfterMs(null), null);
  assert.equal(retryAfterMs('not-a-number'), null);
  assert.equal(retryAfterMs('100000'), 30_000); // capped at 30s
});

test('client retries a 429 then succeeds (honouring Retry-After)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-retry-'));
  const client = new LeetCodeClient(new AppConfig({ cwd: dir }));

  const orig = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '0' } });
    return new Response(JSON.stringify({ data: { ok: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const data = await client.graphql('query {}', {});
    assert.deepEqual(data, { ok: 1 });
    assert.equal(calls, 2); // one 429 retry, then success
  } finally {
    globalThis.fetch = orig;
  }
});

test('client gives up after repeated 429 and surfaces the status', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-retry-'));
  const client = new LeetCodeClient(new AppConfig({ cwd: dir }));

  const orig = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'retry-after': '0' } });
  }) as typeof fetch;

  try {
    await assert.rejects(() => client.graphql('query {}', {}), /429/);
    assert.ok(calls >= 2, `expected multiple attempts, got ${calls}`);
  } finally {
    globalThis.fetch = orig;
  }
});
