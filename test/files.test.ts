import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLang,
  langExtension,
  extToLang,
  commentPrefix,
  difficultyDir,
  categoryDir,
  solutionPath,
  buildSolutionFile,
  parseHeader,
  stripHeader,
  findSnippet,
  availableLangs,
} from '../src/lib/files.ts';

test('normalizeLang maps common aliases to canonical langSlugs', () => {
  assert.equal(normalizeLang('go'), 'golang');
  assert.equal(normalizeLang('py'), 'python3');
  assert.equal(normalizeLang('C++'), 'cpp');
  assert.equal(normalizeLang('c#'), 'csharp');
  assert.equal(normalizeLang('JS'), 'javascript');
  assert.equal(normalizeLang('ts'), 'typescript');
  assert.equal(normalizeLang('python3'), 'python3');
  assert.equal(normalizeLang('somethingelse'), 'somethingelse');
});

test('langExtension maps langSlug to extension', () => {
  assert.equal(langExtension('python3'), 'py');
  assert.equal(langExtension('golang'), 'go');
  assert.equal(langExtension('mysql'), 'sql');
  assert.equal(langExtension('csharp'), 'cs');
  assert.equal(langExtension('mystery'), 'mystery');
});

test('extToLang reverses the extension map', () => {
  assert.equal(extToLang('py'), 'python3');
  assert.equal(extToLang('go'), 'golang');
  assert.equal(extToLang('cpp'), 'cpp');
  assert.equal(extToLang('xyz'), undefined);
});

test('commentPrefix per language', () => {
  assert.equal(commentPrefix('python3'), '#');
  assert.equal(commentPrefix('mysql'), '--');
  assert.equal(commentPrefix('racket'), ';');
  assert.equal(commentPrefix('erlang'), '%');
  assert.equal(commentPrefix('cpp'), '//');
});

test('difficultyDir and categoryDir', () => {
  assert.equal(difficultyDir('Easy'), 'easy');
  assert.equal(difficultyDir('HARD'), 'hard');
  assert.equal(difficultyDir('weird'), 'other');
  assert.equal(categoryDir(['Hash Table', 'array']), 'hash-table');
  assert.equal(categoryDir([]), 'uncategorized');
});

test('solutionPath builds {workdir}/{difficulty}/{category}/{id}.{slug}.{ext}', () => {
  const p = solutionPath({
    workdir: '/w',
    difficulty: 'Easy',
    category: 'array',
    frontendId: '1',
    slug: 'two-sum',
    langSlug: 'python3',
  });
  assert.equal(p, '/w/easy/array/1.two-sum.py');
});

test('buildSolutionFile + parseHeader round-trip (quotes in title)', () => {
  const meta = { id: '1', questionId: '1', slug: 'two-sum', lang: 'python3', title: 'Two "Sum"', site: 'leetcode.com' };
  const file = buildSolutionFile('class Solution: pass', meta);
  const parsed = parseHeader(file);
  assert.ok(parsed);
  assert.equal(parsed?.id, '1');
  assert.equal(parsed?.questionId, '1');
  assert.equal(parsed?.slug, 'two-sum');
  assert.equal(parsed?.lang, 'python3');
  assert.equal(parsed?.site, 'leetcode.com');
  assert.equal(parsed?.title, "Two 'Sum'");
});

test('parseHeader returns null when there is no header', () => {
  assert.equal(parseHeader('class Solution {}'), null);
});

test('stripHeader removes the metadata header line', () => {
  const file = buildSolutionFile('code\nline2', { id: '1', questionId: '1', slug: 's', lang: 'cpp', title: 'T', site: 'leetcode.com' });
  const stripped = stripHeader(file);
  assert.ok(!stripped.includes('@leetcode'));
  assert.ok(stripped.startsWith('code'));
});

test('stripHeader preserves a later @leetcode mention in the body', () => {
  const file = buildSolutionFile('x = 1  # see @leetcode docs\ny = 2', {
    id: '1', questionId: '1', slug: 's', lang: 'python3', title: 'T', site: 'leetcode.com',
  });
  const stripped = stripHeader(file);
  assert.ok(stripped.includes('see @leetcode docs'), stripped);
  assert.ok(!stripped.startsWith('# @leetcode id='), stripped);
});

test('solutionPath blocks path traversal via slug', () => {
  const p = solutionPath({ workdir: '/w', difficulty: 'Easy', category: 'array', frontendId: '1', slug: '../../etc/passwd', langSlug: 'python3' });
  assert.ok(!p.includes('..'), p);
});

test('categoryDir rejects dot-only segments', () => {
  assert.equal(categoryDir(['..']), 'uncategorized');
  assert.equal(categoryDir(['.']), 'uncategorized');
});

test('findSnippet and availableLangs', () => {
  const snips = [
    { lang: 'Python3', langSlug: 'python3', code: 'a' },
    { lang: 'C++', langSlug: 'cpp', code: 'b' },
  ];
  assert.equal(findSnippet(snips, 'cpp')?.code, 'b');
  assert.equal(findSnippet(snips, 'rust'), null);
  assert.deepEqual(availableLangs(snips), ['python3', 'cpp']);
});
