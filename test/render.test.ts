import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, decodeEntities } from '../src/lib/render.ts';
import { stripAnsi } from './_helpers.ts';

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('a &lt;= b &amp;&amp; c'), 'a <= b && c');
  assert.equal(decodeEntities('&#65;&#66;'), 'AB');
  assert.equal(decodeEntities('&#x41;'), 'A');
  assert.equal(decodeEntities('x &le; y &ge; z'), 'x ≤ y ≥ z');
});

test('renderHtml keeps constraint operators and exponents', () => {
  const html = '<ul><li><code>2 &lt;= n &lt;= 10<sup>4</sup></code></li><li>O(n<sup>2</sup>)</li></ul>';
  const out = stripAnsi(renderHtml(html));
  assert.ok(out.includes('2 <= n <= 10^4'), out);
  assert.ok(out.includes('O(n^2)'), out);
  assert.ok(out.includes('•'), out);
});

test('renderHtml preserves <pre> block line breaks', () => {
  const html = '<p>Example:</p><pre>Input: x = 1\nOutput: 2</pre>';
  const out = stripAnsi(renderHtml(html));
  assert.ok(out.includes('Input: x = 1'));
  assert.ok(out.includes('Output: 2'));
});

test('renderHtml strips unknown tags and decodes entities', () => {
  const out = stripAnsi(renderHtml('<div class="x">a &amp; b</div>'));
  assert.equal(out.trim(), 'a & b');
});

test('regression: a decoded < must not eat following text', () => {
  const html = '<p>If <code>a &lt; b</code> then return true and continue</p>';
  const out = stripAnsi(renderHtml(html));
  assert.ok(out.includes('a < b'), out);
  assert.ok(out.includes('then return true and continue'), out);
});

test('renderHtml handles empty input', () => {
  assert.equal(renderHtml(''), '');
});
