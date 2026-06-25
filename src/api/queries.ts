/**
 * GraphQL query strings, reverse-engineered from the `leetcode-query` package
 * (JacobLinCool/LeetCode-Query) and cross-checked against skygragon/clearloop/
 * leetgo CLIs. See scratchpad/API-SPEC.md for provenance.
 *
 * Most queries are trimmed to only the fields this CLI consumes. The single
 * `QUESTION_DETAIL` selection is intentionally a subset that exists in BOTH the
 * leetcode.com and leetcode.cn schemas, so one query serves both sites. The
 * problem list, daily, and user-status queries genuinely differ between sites,
 * so each has a `.com` and `.cn` variant; the client normalises the results.
 */
import type { Site } from '../config.js';

/** Problem detail — works on both sites (translated* are only populated on .cn). */
export const QUESTION_DETAIL = /* GraphQL */ `
query questionDetail($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    content
    translatedTitle
    translatedContent
    difficulty
    isPaidOnly
    likes
    dislikes
    status
    stats
    similarQuestions
    exampleTestcases
    sampleTestCase
    hints
    topicTags { name slug translatedName }
    codeSnippets { lang langSlug code }
  }
}`;

/** Problem list — .com (`questionList` aliased to `problemsetQuestionList`). */
const PROBLEM_LIST_COM = /* GraphQL */ `
query problemList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      questionFrontendId
      isPaidOnly
      status
      title
      titleSlug
      topicTags { name slug }
    }
  }
}`;

/** Problem list — .cn (real `problemsetQuestionList` field, different inner names). */
const PROBLEM_LIST_CN = /* GraphQL */ `
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total
    questions {
      acRate
      difficulty
      frontendQuestionId
      paidOnly
      status
      title
      titleCn
      titleSlug
      topicTags { name slug nameTranslated }
    }
  }
}`;

/** Daily challenge — .com. Returns a single object. */
const DAILY_COM = /* GraphQL */ `
query daily {
  activeDailyCodingChallengeQuestion {
    date
    link
    question {
      questionFrontendId
      title
      titleSlug
      difficulty
    }
  }
}`;

/** Daily challenge — .cn. `todayRecord` is an array; take [0]. */
const DAILY_CN = /* GraphQL */ `
query questionOfToday {
  todayRecord {
    date
    question {
      questionFrontendId
      title
      titleSlug
      difficulty
    }
  }
}`;

/** Signed-in user status (whoami / login validation) — .com. */
const USER_STATUS_COM = /* GraphQL */ `
query globalData {
  userStatus {
    userId
    username
    isSignedIn
    isPremium
  }
}`;

/** Signed-in user status — .cn. */
const USER_STATUS_CN = /* GraphQL */ `
query userStatus {
  userStatus {
    username
    isSignedIn
    realName
    userSlug
  }
}`;

/** Pick the site-appropriate problem-list query. */
export function problemListQuery(site: Site): string {
  return site === 'leetcode.cn' ? PROBLEM_LIST_CN : PROBLEM_LIST_COM;
}

/** Pick the site-appropriate daily-challenge query. */
export function dailyQuery(site: Site): string {
  return site === 'leetcode.cn' ? DAILY_CN : DAILY_COM;
}

/** Pick the site-appropriate user-status query. */
export function userStatusQuery(site: Site): string {
  return site === 'leetcode.cn' ? USER_STATUS_CN : USER_STATUS_COM;
}
