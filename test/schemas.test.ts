import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  questionSchema,
  checkResultSchema,
  listResponseSchema,
  userStatusSchema,
  STATUS_CODES,
  submissionListSchema,
  submissionDetailsComSchema,
  submissionDetailCnSchema,
} from '../src/api/schemas.ts';

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

test('submissionListSchema parses .com and .cn submission lists', () => {
  const com = submissionListSchema.parse({
    submissionList: {
      hasNext: true,
      submissions: [
        { id: '123', statusDisplay: 'Accepted', lang: 'cpp', timestamp: 1700000000, title: 'Two Sum', titleSlug: 'two-sum' },
        { id: 122, statusDisplay: 'Wrong Answer', lang: 'cpp', timestamp: 1699999999 },
      ],
    },
  });
  assert.equal(com.submissionList?.submissions?.[0]?.statusDisplay, 'Accepted');
  assert.equal(com.submissionList?.submissions?.[0]?.id, '123');
  assert.equal(com.submissionList?.submissions?.[1]?.id, 122);

  const cn = submissionListSchema.parse({
    submissionList: {
      lastKey: 'abc',
      hasNext: false,
      submissions: [{ id: '9', statusDisplay: 'Accepted', lang: 'python3', timestamp: '1700000000' }],
    },
  });
  assert.equal(cn.submissionList?.lastKey, 'abc');
  assert.equal(cn.submissionList?.submissions?.[0]?.lang, 'python3');
});

test('submissionDetailsComSchema reads code + lang object + questionId', () => {
  const d = submissionDetailsComSchema.parse({
    submissionDetails: { code: 'class Solution {}', lang: { name: 'cpp' }, question: { questionId: '1', titleSlug: 'two-sum' } },
  });
  assert.equal(d.submissionDetails?.code, 'class Solution {}');
  assert.equal(d.submissionDetails?.lang?.name, 'cpp');
  assert.equal(d.submissionDetails?.question?.questionId, '1');
});

test('submissionDetailCnSchema reads code + lang string', () => {
  const d = submissionDetailCnSchema.parse({
    submissionDetail: { code: 'print(1)', lang: 'python3', question: { questionId: '1', titleSlug: 'two-sum' } },
  });
  assert.equal(d.submissionDetail?.code, 'print(1)');
  assert.equal(d.submissionDetail?.lang, 'python3');
});

test('STATUS_CODES maps judge codes', () => {
  assert.equal(STATUS_CODES[10], 'Accepted');
  assert.equal(STATUS_CODES[14], 'Time Limit Exceeded');
  assert.equal(STATUS_CODES[20], 'Compile Error');
});
