/**
 * Zod schemas validating the (untyped) JSON LeetCode returns.
 *
 * Zod object schemas strip unknown keys by default, so we only declare the
 * fields we actually read; everything else is ignored. Fields LeetCode may
 * return as null are `.nullable()`, and the notorious string-or-array result
 * fields are normalised to `string[]`.
 */
import { z } from 'zod';

export const codeSnippetSchema = z.object({
  lang: z.string(),
  langSlug: z.string(),
  code: z.string(),
});
export type CodeSnippet = z.infer<typeof codeSnippetSchema>;

export const topicTagSchema = z.object({
  name: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  translatedName: z.string().nullable().optional(),
  nameTranslated: z.string().nullable().optional(),
});

/** Problem detail (shared minimal selection across both sites). */
export const questionSchema = z.object({
  questionId: z.string(),
  questionFrontendId: z.string(),
  title: z.string(),
  titleSlug: z.string(),
  content: z.string().nullable().optional(),
  translatedTitle: z.string().nullable().optional(),
  translatedContent: z.string().nullable().optional(),
  difficulty: z.string(),
  isPaidOnly: z.boolean().optional().default(false),
  likes: z.number().nullable().optional(),
  dislikes: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  stats: z.string().nullable().optional(),
  similarQuestions: z.string().nullable().optional(),
  exampleTestcases: z.string().nullable().optional(),
  sampleTestCase: z.string().nullable().optional(),
  hints: z.array(z.string()).nullable().optional().default([]),
  topicTags: z.array(topicTagSchema).nullable().optional().default([]),
  codeSnippets: z.array(codeSnippetSchema).nullable().optional().default([]),
});
export type Question = z.infer<typeof questionSchema>;

/** Raw problem-list row (union of .com and .cn field names). */
export const listRowSchema = z.object({
  acRate: z.number().nullable().optional(),
  difficulty: z.string(),
  questionFrontendId: z.string().nullable().optional(),
  frontendQuestionId: z.string().nullable().optional(),
  isPaidOnly: z.boolean().nullable().optional(),
  paidOnly: z.boolean().nullable().optional(),
  status: z.string().nullable().optional(),
  title: z.string(),
  titleCn: z.string().nullable().optional(),
  titleSlug: z.string(),
  topicTags: z.array(topicTagSchema).nullable().optional().default([]),
});

export const listResponseSchema = z.object({
  problemsetQuestionList: z
    .object({
      total: z.number().nullable().optional(),
      questions: z.array(listRowSchema).nullable().optional().default([]),
    })
    .nullable(),
});

/** Normalised problem-list item used throughout the CLI. */
export interface ProblemListItem {
  readonly frontendId: string;
  readonly title: string;
  readonly titleSlug: string;
  readonly difficulty: string;
  readonly paidOnly: boolean;
  readonly status: string | null;
  readonly acRate: number | null;
  readonly tags: readonly string[];
}

export const userStatusSchema = z.object({
  isSignedIn: z.boolean(),
  username: z.string().nullable().optional(),
  userId: z.union([z.string(), z.number()]).nullable().optional(),
  isPremium: z.boolean().nullable().optional(),
  realName: z.string().nullable().optional(),
  userSlug: z.string().nullable().optional(),
});
export type UserStatus = z.infer<typeof userStatusSchema>;

const dailyQuestionRef = z.object({
  questionFrontendId: z.string(),
  title: z.string(),
  titleSlug: z.string(),
  difficulty: z.string(),
});

export const dailyResponseSchema = z.object({
  // .com
  activeDailyCodingChallengeQuestion: z
    .object({ date: z.string().nullable().optional(), link: z.string().nullable().optional(), question: dailyQuestionRef })
    .nullable()
    .optional(),
  // .cn
  todayRecord: z
    .array(z.object({ date: z.string().nullable().optional(), question: dailyQuestionRef }))
    .nullable()
    .optional(),
});

/** Normalise the string-or-array judge fields to a string array. */
const stringOrArray = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]));

/** REST run/submit poll result. Tolerant: most fields are optional/nullable. */
export const checkResultSchema = z.object({
  state: z.string(),
  status_code: z.number().nullable().optional(),
  status_msg: z.string().nullable().optional(),
  status_runtime: z.string().nullable().optional(),
  status_memory: z.string().nullable().optional(),
  run_success: z.boolean().nullable().optional(),
  total_correct: z.number().nullable().optional(),
  total_testcases: z.number().nullable().optional(),
  runtime_percentile: z.number().nullable().optional(),
  memory_percentile: z.number().nullable().optional(),
  compare_result: z.string().nullable().optional(),
  correct_answer: z.boolean().nullable().optional(),
  code_answer: stringOrArray.optional(),
  expected_code_answer: stringOrArray.optional(),
  code_output: stringOrArray.optional(),
  std_output: stringOrArray.optional(),
  expected_output: z.string().nullable().optional(),
  last_testcase: z.string().nullable().optional(),
  input: z.string().nullable().optional(),
  runtime_error: z.string().nullable().optional(),
  full_runtime_error: z.string().nullable().optional(),
  compile_error: z.string().nullable().optional(),
  full_compile_error: z.string().nullable().optional(),
  pretty_lang: z.string().nullable().optional(),
  lang: z.string().nullable().optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/** Response of POST interpret_solution/. */
export const interpretResponseSchema = z.object({
  interpret_id: z.string().optional(),
  interpret_expected_id: z.string().optional(),
  test_case: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

/** Response of POST submit/. */
export const submitResponseSchema = z.object({
  submission_id: z.union([z.number(), z.string()]).optional(),
  error: z.string().nullable().optional(),
});

/** Row from the REST /api/problems/all/ endpoint (used for id→slug resolution). */
export const allProblemsSchema = z.object({
  stat_status_pairs: z.array(
    z.object({
      stat: z.object({
        question_id: z.number(),
        question__title: z.string(),
        question__title_slug: z.string(),
        frontend_question_id: z.number(),
      }),
      difficulty: z.object({ level: z.number() }),
      paid_only: z.boolean(),
    }),
  ),
});

/** Judge status_code → human label. */
export const STATUS_CODES: Record<number, string> = {
  10: 'Accepted',
  11: 'Wrong Answer',
  12: 'Memory Limit Exceeded',
  13: 'Output Limit Exceeded',
  14: 'Time Limit Exceeded',
  15: 'Runtime Error',
  16: 'Internal Error',
  20: 'Compile Error',
  21: 'Unknown Error',
};
