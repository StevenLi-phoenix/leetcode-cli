import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionSchema, checkResultSchema, listResponseSchema, userStatusSchema, STATUS_CODES } from '../src/api/schemas.ts';

test('questionSchema tolerates nulls and applies defaults', () => {
  const q = questionSchema.parse({
    questionId: '1',
    questionFrontendId: '1',
    title: 'T',
    titleSlug: 't',
    difficulty: 'Easy',
    content: null,
    translatedContent: null,
  });
  assert.equal(q.isPaidOnly, false);
  assert.deepEqual(q.hints, []);
  assert.deepEqual(q.topicTags, []);
  assert.deepEqual(q.codeSnippets, []);
});

test('checkResultSchema normalises string-or-array fields to arrays', () => {
  assert.deepEqual(checkResultSchema.parse({ state: 'SUCCESS', code_answer: 'x' }).code_answer, ['x']);
  assert.deepEqual(checkResultSchema.parse({ state: 'SUCCESS', code_answer: ['a', 'b'] }).code_answer, ['a', 'b']);
});

test('listResponseSchema accepts both .com and .cn shapes', () => {
  const com = listResponseSchema.parse({
    problemsetQuestionList: {
      total: 1,
      questions: [{ difficulty: 'Easy', questionFrontendId: '1', title: 'T', titleSlug: 't', acRate: 50, isPaidOnly: false }],
    },
  });
  assert.equal(com.problemsetQuestionList?.questions?.[0]?.questionFrontendId, '1');

  const cn = listResponseSchema.parse({
    problemsetQuestionList: {
      total: 1,
      questions: [{ difficulty: 'EASY', frontendQuestionId: '1', title: 'T', titleCn: '标题', titleSlug: 't', acRate: 0.5, paidOnly: false }],
    },
  });
  assert.equal(cn.problemsetQuestionList?.questions?.[0]?.titleCn, '标题');
});

test('userStatusSchema parses a minimal status', () => {
  const u = userStatusSchema.parse({ isSignedIn: true, username: 'me' });
  assert.equal(u.isSignedIn, true);
  assert.equal(u.username, 'me');
});

test('STATUS_CODES maps judge codes', () => {
  assert.equal(STATUS_CODES[10], 'Accepted');
  assert.equal(STATUS_CODES[14], 'Time Limit Exceeded');
  assert.equal(STATUS_CODES[20], 'Compile Error');
});
