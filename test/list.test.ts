import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDifficulty, parseStatus } from '../src/commands/list.ts';

test('parseDifficulty maps to the API enum', () => {
  assert.equal(parseDifficulty('easy'), 'EASY');
  assert.equal(parseDifficulty('Medium'), 'MEDIUM');
  assert.equal(parseDifficulty('HARD'), 'HARD');
  assert.equal(parseDifficulty(undefined), undefined);
  assert.throws(() => parseDifficulty('insane'), /Invalid difficulty/);
});

test('parseStatus maps friendly names to the status filter enum', () => {
  assert.equal(parseStatus('unsolved'), 'NOT_STARTED');
  assert.equal(parseStatus('todo'), 'NOT_STARTED');
  assert.equal(parseStatus('solved'), 'AC');
  assert.equal(parseStatus('ac'), 'AC');
  assert.equal(parseStatus('attempted'), 'TRIED');
  assert.equal(parseStatus('TRIED'), 'TRIED');
  assert.equal(parseStatus(undefined), undefined);
  assert.throws(() => parseStatus('bogus'), /Invalid status/);
});
