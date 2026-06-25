import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficulty, statusIcon, acceptance, padStart } from '../src/lib/format.ts';
import { stripAnsi } from './_helpers.ts';

test('difficulty returns the label (coloured)', () => {
  assert.equal(stripAnsi(difficulty('Easy')), 'Easy');
  assert.equal(stripAnsi(difficulty('Medium')), 'Medium');
  assert.equal(stripAnsi(difficulty('Hard')), 'Hard');
});

test('statusIcon reflects solve state', () => {
  assert.equal(stripAnsi(statusIcon('ac')), '✔');
  assert.equal(stripAnsi(statusIcon('notac')), '✖');
  assert.equal(statusIcon(null), ' ');
  assert.equal(statusIcon(undefined), ' ');
});

test('acceptance formats to one decimal', () => {
  assert.equal(acceptance(57.74), '57.7%');
  assert.equal(acceptance(100), '100.0%');
});

test('padStart pads and never truncates', () => {
  assert.equal(padStart('1', 3), '  1');
  assert.equal(padStart('toolong', 3), 'toolong');
});
