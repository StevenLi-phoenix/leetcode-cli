# LeetCode CLI — Canonical API Specification

> **Status:** Authoritative merge of three recon reports. The implementer should follow this document exactly.
>
> **Confidence legend:**
> - **[VERBATIM]** — copied char-for-char from real source (`leetcode-query@2.0.1` `src/graphql/*.graphql`). Highest trust.
> - **[FROM-CLI]** — from one or more real CLIs (skygragon JS, clearloop Rust, j178/leetgo Go, night-slayer18 TS). High trust; cross-confirmed where noted.
> - **[INFERRED]** — reasoned, not directly observed in source. Verify before relying.
>
> **Conflict-resolution rule applied:** when reports disagreed, the VERBATIM-from-source value wins over FROM-CLI/INFERRED. Remaining genuine contradictions are flagged inline with **⚠ CONFLICT**.
>
> **Primary sources:**
> - GraphQL (reads): `leetcode-query@2.0.1` (JacobLinCool/LeetCode-Query) — read-only, no submit/run.
> - REST submit/run/check: skygragon `leetcode-cli` + clearloop `leetcode-cli` (Rust) + j178/leetgo (Go) + night-slayer18 (TS) — 3–4 independent CLIs agree.

---

## 1. Endpoints

| Purpose | leetcode.com | leetcode.cn |
|---|---|---|
| Base URL | `https://leetcode.com` | `https://leetcode.cn` |
| GraphQL (POST) | `https://leetcode.com/graphql` **(no trailing slash)** ⚠ | `https://leetcode.cn/graphql/` **(trailing slash)** |
| GraphQL alt endpoint | — | `https://leetcode.cn/graphql/noj-go/` (for `userContestRankingInfo`, `recentACSubmissions`, `userProgressQuestionList`) |
| CSRF bootstrap | `GET https://leetcode.com/graphql/` (read `csrftoken` from `set-cookie`) | `POST https://leetcode.cn/graphql/` op `nojGlobalData` (read `csrftoken` from `set-cookie`) |
| Run / test (REST POST) | `https://leetcode.com/problems/{slug}/interpret_solution/` | `https://leetcode.cn/problems/{slug}/interpret_solution/` |
| Submit (REST POST) | `https://leetcode.com/problems/{slug}/submit/` | `https://leetcode.cn/problems/{slug}/submit/` |
| Check / poll (REST GET) | `https://leetcode.com/submissions/detail/{id}/check/` | `https://leetcode.cn/submissions/detail/{id}/check/` |
| Submission detail page | `https://leetcode.com/submissions/detail/{id}/` | `https://leetcode.cn/submissions/detail/{id}/` |
| REST problem list | `https://leetcode.com/api/problems/{category}/` (e.g. `all`) | `https://leetcode.cn/api/problems/{category}/` |
| Own submissions (legacy REST) | `https://leetcode.com/api/submissions/{slug}` | same shape |
| Login (legacy) | `https://leetcode.com/accounts/login/` | same shape |
| Contest submit variant | `https://leetcode.com/contest/api/{contestSlug}/problems/{slug}/submit/` | same shape |

**Key facts**
- **The `.com` GraphQL POST has NO trailing slash (`/graphql`); the `.cn` POST DOES (`/graphql/`).** Mismatching can cause a redirect that drops the POST body. [VERBATIM — `leetcode-query`]
  - ⚠ MINOR CONFLICT: one report cites `.com` GraphQL as `/graphql/` (with slash). The VERBATIM `leetcode-query` source uses `/graphql` (no slash) for the POST and `/graphql/` only for the CSRF-bootstrap GET. **Use `/graphql` (no slash) for `.com` POSTs.** Both forms likely work via redirect, but no-slash is the verified one.
- Run/Submit/Check is **REST, not GraphQL** — confirmed verbatim across skygragon, clearloop, leetgo, night-slayer18. GraphQL is only for problem metadata/listing/daily/user reads. [FROM-CLI, 4 sources]
- `{id}` in the check URL is the `interpret_id` (from run) **or** the `submission_id` (from submit). The same check endpoint serves both. [FROM-CLI]
- `.cn` and `.com` use **separate accounts/cookies** — sessions are NOT shared. Cookie domain matches the host. [FROM-CLI]

---

## 2. Headers

### 2.1 GraphQL requests

**leetcode.com** [VERBATIM — `src/leetcode.ts`]
```
content-type: application/json
origin:       https://leetcode.com
referer:      https://leetcode.com
cookie:       csrftoken=<csrf>; LEETCODE_SESSION=<session>;
x-csrftoken:  <csrf>
user-agent:   Mozilla/5.0 LeetCode API
```

**leetcode.cn** [VERBATIM — `src/leetcode-cn.ts`] — adds `accept` + `accept-language`
```
accept:          application/json
accept-language: zh-CN,zh;q=0.9,en;q=0.8
content-type:    application/json
origin:          https://leetcode.cn
referer:         https://leetcode.cn
cookie:          csrftoken=<csrf>; LEETCODE_SESSION=<session>;
x-csrftoken:     <csrf>
user-agent:      Mozilla/5.0 LeetCode API
```

- Method POST, body = `JSON.stringify({ query, variables })`.
- **Auth is cookie-only.** `LEETCODE_SESSION` is the login JWT. `x-csrftoken` must equal the `csrftoken` cookie value. [VERBATIM]
- CSRF is auto-rotated from any response `set-cookie` — read & persist it on every response. [VERBATIM]
- `user-agent`: the package literal is `Mozilla/5.0 LeetCode API`. A bot-looking UA can be 403'd on the REST endpoints (see below) — prefer a real browser UA there. [VERBATIM literal; browser-UA note FROM-CLI]

### 2.2 REST submit / interpret / check requests

```
Content-Type:     application/json
Cookie:           LEETCODE_SESSION=<session>; csrftoken=<csrf>;
X-CSRFToken:      <csrf>                                  (must equal csrftoken cookie value)
X-Requested-With: XMLHttpRequest
Origin:           https://leetcode.com   (or https://leetcode.cn)
Referer:          https://leetcode.com/problems/{slug}/   ← MANDATORY: the problem-page URL
User-Agent:       Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36   (a real browser UA)
```

- **`Referer` MUST be the problem page URL** (`https://leetcode.com/problems/{slug}/`) or LeetCode returns **403** on run/submit. [FROM-CLI, all sources]
  - skygragon uses the `.../problems/{slug}/description/` variant; clearloop also uses `.../description/`. Either the bare `/problems/{slug}/` or the `.../description/` form works.
- `X-Requested-With: XMLHttpRequest` is sent by skygragon, clearloop, leetgo on all REST calls. [FROM-CLI]
- `403`/`401` on any REST call ⇒ session expired ⇒ re-login. [FROM-CLI]
- The check (`GET .../check/`) needs the auth `Cookie`; `Referer`/`Origin` are less strict there but include them.

---

## 3. GraphQL Queries

All query strings below are **[VERBATIM]** from `leetcode-query@2.0.1` `src/graphql/` unless marked otherwise.

### (a) Problem list / problemsetQuestionList

**`.com`** — `data.problemsetQuestionList → { total, questions[] }`
Variables: `{ categorySlug: String, limit: Int, skip: Int, filters: QuestionListFilterInput }`
`filters` e.g. `{ difficulty: "EASY"|"MEDIUM"|"HARD", tags: [slug], searchKeywords: String }`
Note: the GraphQL field is actually `questionList` aliased to `problemsetQuestionList`; results nest under `data` aliased to `questions` and `totalNum` aliased to `total`.

```graphql
query ($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
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
            freqBar
            questionFrontendId
            isFavor
            isPaidOnly
            status
            title
            titleSlug
            topicTags {
                name
                id
                slug
            }
            hasSolution
            hasVideoSolution
        }
    }
}
```

**`.cn`** — `data.problemsetQuestionList → { hasMore, total, questions[] }` (op name `problemsetQuestionList`; inner fields differ: `frontendQuestionId`/`paidOnly`/`titleCn`/`solutionNum`/`nameTranslated`)
Variables: same shape `{ categorySlug, limit, skip, filters }`

```graphql
query problemsetQuestionList(
    $categorySlug: String
    $limit: Int
    $skip: Int
    $filters: QuestionListFilterInput
) {
    problemsetQuestionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
    ) {
        hasMore
        total
        questions {
            acRate
            difficulty
            freqBar
            frontendQuestionId
            isFavor
            paidOnly
            solutionNum
            status
            title
            titleCn
            titleSlug
            topicTags {
                name
                nameTranslated
                id
                slug
            }
        }
    }
}
```

### (b) Single problem — content + metadata + codeSnippets

**`.com`** — `data.question`. Variables: `{ titleSlug: String! }`
`codeSnippets[] = { lang, langSlug, code }`. `content` is HTML. `metaData`/`stats`/`companyTagStats`/`envInfo`/`similarQuestions` are **stringified JSON** (need a second parse). `questionId` is the **INTERNAL id** required for submit/interpret.

```graphql
query ($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        boundTopicId
        title
        titleSlug
        content
        translatedTitle
        translatedContent
        isPaidOnly
        difficulty
        likes
        dislikes
        isLiked
        similarQuestions
        exampleTestcases
        contributors {
            username
            profileUrl
            avatarUrl
        }
        topicTags {
            name
            slug
            translatedName
        }
        companyTagStats
        codeSnippets {
            lang
            langSlug
            code
        }
        stats
        hints
        solution {
            id
            canSeeDetail
            paidOnly
            hasVideoSolution
            paidOnlyVideo
        }
        status
        sampleTestCase
        metaData
        judgerAvailable
        judgeType
        mysqlSchemas
        enableRunCode
        enableTestMode
        enableDebugger
        envInfo
        libraryUrl
        adminUrl
        challengeQuestion {
            id
            date
            incompleteChallengeCount
            streakCount
            type
        }
        note
    }
}
```

**`.cn`** — `data.question`. Same variable. `translatedTitle`/`translatedContent` hold Chinese HTML (prefer them when non-null on `.cn`); `content`/`title` hold English. **Strip the `.com`-only fields** (`solution.paidOnly/hasVideoSolution/paidOnlyVideo`, `enableDebugger`, `envInfo`, `adminUrl`, `challengeQuestion {...}`) or the `.cn` query errors.

```graphql
query ($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        boundTopicId
        title
        titleSlug
        content
        translatedTitle
        translatedContent
        isPaidOnly
        difficulty
        likes
        dislikes
        isLiked
        similarQuestions
        exampleTestcases
        contributors {
            username
            profileUrl
            avatarUrl
        }
        topicTags {
            name
            slug
            translatedName
        }
        companyTagStats
        codeSnippets {
            lang
            langSlug
            code
        }
        stats
        hints
        solution {
            id
            canSeeDetail
        }
        status
        sampleTestCase
        metaData
        judgerAvailable
        judgeType
        mysqlSchemas
        enableRunCode
        enableTestMode
        libraryUrl
        note
    }
}
```

### (c) Problem hints

There is **no standalone `hints` query** in any source. Hints come back as the `hints` field **inside the single-problem query (b)** — an array of HTML/markdown strings: `data.question.hints` = `[String]`. Request `hints` in the problem query (already included above). [VERBATIM — field present in `problem.graphql` on both `.com` and `.cn`]

If a hints-only fetch is desired (UNVERIFIED — no source has this exact minimal query; safe approximation):
```graphql
# UNVERIFIED minimal form — derived by trimming the verbatim problem query
query ($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        hints
    }
}
```

### (d) Daily challenge

**`.com`** — `data.activeDailyCodingChallengeQuestion → { date, link, question{...} }`. No variables. (The `question` object carries the SAME full field set as query (b) — see source; abbreviated here, expand to the full problem field set when implementing.)

```graphql
query {
    activeDailyCodingChallengeQuestion {
        date
        link
        question {
            questionId
            questionFrontendId
            boundTopicId
            title
            titleSlug
            content
            translatedTitle
            translatedContent
            isPaidOnly
            difficulty
            likes
            dislikes
            isLiked
            similarQuestions
            exampleTestcases
            contributors {
                username
                profileUrl
                avatarUrl
            }
            topicTags {
                name
                slug
                translatedName
            }
            companyTagStats
            codeSnippets {
                lang
                langSlug
                code
            }
            stats
            hints
            solution {
                id
                canSeeDetail
                paidOnly
                hasVideoSolution
                paidOnlyVideo
            }
            status
            sampleTestCase
            metaData
            judgerAvailable
            judgeType
            mysqlSchemas
            enableRunCode
            enableTestMode
            enableDebugger
            envInfo
            libraryUrl
            adminUrl
            challengeQuestion {
                id
                date
                incompleteChallengeCount
                streakCount
                type
            }
            note
        }
    }
}
```

**`.cn`** — op name `questionOfToday`; field `todayRecord` is an **ARRAY — take `[0]`**. No `link` field. No variables.

```graphql
query questionOfToday {
    todayRecord {
        date
        userStatus
        question {
            questionId
            frontendQuestionId: questionFrontendId
            difficulty
            title
            titleCn: translatedTitle
            titleSlug
            paidOnly: isPaidOnly
            freqBar
            isFavor
            acRate
            status
            solutionNum
            hasVideoSolution
            topicTags {
                name
                nameTranslated: translatedName
                id
            }
            extra {
                topCompanyTags {
                    imgUrl
                    slug
                    numSubscribed
                }
            }
        }
        lastSubmission {
            id
        }
    }
}
```
Note: the `.cn` daily question carries only listing-level fields (no `content`/`codeSnippets`). leetgo's pattern: fetch `titleSlug` from `questionOfToday`, then re-fetch full content via the problem query (b). [FROM-CLI]

### (e) whoami / userStatus

**`.com`** — `data.userStatus`. No variables (send `{}`). Auth required (returns `isSignedIn: false` if not logged in).

```graphql
query {
    userStatus {
        userId
        username
        avatar
        isSignedIn
        isMockUser
        isPremium
        isAdmin
        isSuperuser
        isTranslator
        permissions
    }
}
```

**`.cn`** — op name `userStatus`; `data.userStatus`. Adds `region`, `useTranslation`, `isPhoneVerified`/`isWechatVerified`/`isStaff`/`isVerified`/`checkedInToday`, and uses `userSlug`.

```graphql
query userStatus {
    userStatus {
        isSignedIn
        isAdmin
        isStaff
        isSuperuser
        isTranslator
        isVerified
        isPhoneVerified
        isWechatVerified
        checkedInToday
        username
        realName
        userSlug
        avatar
        region
        permissions
        useTranslation
    }
}
```

### (f) Random / filter

**There is NO dedicated `random` query in any source.** [VERBATIM grep — none found]
Randomization is done **client-side**: call the problem-list query (a) with a `filters` object, then pick a random entry from `questions[]`. The `filters: QuestionListFilterInput` supports difficulty/tags filtering:

```
filters = {
    difficulty: "EASY" | "MEDIUM" | "HARD",      // optional
    tags: ["array", "dynamic-programming", ...],  // optional, topic slugs
    searchKeywords: "two sum",                    // optional, free text
    listId: "<favorite list id>",                 // optional
    status: "AC" | "NOT_STARTED" | "TRIED"        // optional (auth)
}
```
`QuestionListFilterInput` field names above are **[INFERRED]** from LeetCode's known schema except `difficulty`/`tags` which appear in the recon notes — **verify the exact `filters` field names against the live schema before relying on `searchKeywords`/`status`/`listId`.**

A common "random" recipe (UNVERIFIED composite, not a single named query):
1. Query (a) with `limit: 1, skip: <random in [0,total)>, filters: {...}` after first fetching `total`, OR
2. Fetch a page and `random.choice` locally.

### Bonus verbatim queries (available, not requested but useful)

- **User profile (`.com`)** — `profile.graphql`: `data.{matchedUser, allQuestionsCount, recentSubmissionList}`, vars `{ username: String! }`.
- **Recent submissions (`.com`)** — `recent-submissions.graphql`: `data.recentSubmissionList`, vars `{ username: String!, limit: Int }`.
- **Own submissions list (`.com`, auth)** — `submissions.graphql`: `data.submissionList → { hasNext, submissions[] }`, vars `{ offset: Int!, limit: Int!, slug: String }` (limit ≤ 20/page; paginate via `hasNext` + `offset += 20`).
- **Submission detail (`.com`, auth)** — `submission-detail.graphql`: `data.submissionDetails` (PLURAL field, `submissionId: Int!`), includes submitted `code`.
- **Submission detail (`.cn`, auth)** — `data.submissionDetail` (SINGULAR field, `submissionId: ID!`), inline fragments on `GeneralSubmissionNode`/`ContestSubmissionNode`.
- **Contest ranking (`.com`)** — `contest.graphql`: `data.{userContestRanking, userContestRankingHistory}`, vars `{ username: String! }`.
- **Contest ranking (`.cn`)** — op `userContestRankingInfo` on `/graphql/noj-go/`.
- **CN user progress (`.cn`, auth, `/graphql/noj-go/`)** — op `userProgressQuestionList`, vars `{ filters: { skip, limit, questionStatus: "SOLVED"|"ATTEMPTED", difficulty: [...] } }`.

(Full verbatim strings for all of these exist in `recon-leetcode-query.md` §3–§4 if needed.)

---

## 4. Run / Submit / Check Protocol (REST)

All three steps are REST. `question_id` in run/submit bodies is the **INTERNAL `questionId`** (from problem query (b)), **NOT** the frontend display number. Get it first via the problem query.

### 4.1 Submit — `POST {base}/problems/{slug}/submit/`

Request body (JSON):
```json
{
  "lang":        "<langSlug, e.g. python3>",
  "question_id": "<internal questionId, int or string>",
  "typed_code":  "<full source code>",
  "judge_type":  "large"
}
```
- `data_input` is **NOT** sent on submit.
- `judge_type: "large"` is sent by skygragon + clearloop. leetgo omits it and instead adds `"questionSlug": "<slug>"`. **Both work; include `judge_type: "large"` (the older, broadly-confirmed form), and optionally `questionSlug`.** [FROM-CLI; minor body-shape variance across CLIs, not a true conflict]
- `test_mode: false` is sent by legacy skygragon (optional).

Response (`200`): `{ "submission_id": 123456789 }` (integer). clearloop treats `submission_id == 0` as a cookie/csrf failure.

### 4.2 Run / test — `POST {base}/problems/{slug}/interpret_solution/`

Request body (JSON):
```json
{
  "lang":        "<langSlug>",
  "question_id": "<internal questionId>",
  "typed_code":  "<full source code>",
  "data_input":  "<test input, newline-separated>",
  "test_mode":   false
}
```
- `data_input` is **REQUIRED** for run (default = `question.exampleTestcases`, newline-joined, or `question.sampleTestCase`).
- `judge_type` is **NOT** sent on interpret (one report listed it as optional; the dominant form omits it).

Response (`200`):
```json
{
  "interpret_id":          "interpret_runcode_<...>",
  "interpret_expected_id": "interpret_expected_<...>",
  "test_case":             "..."
}
```
- Poll the check endpoint with `interpret_id` for YOUR code's output.
- Optionally poll `interpret_expected_id` for the expected output (skygragon polls both; clearloop/night-slayer/leetgo poll only `interpret_id` and read `expected_code_answer` off the same result). clearloop treats an empty `interpret_id` as a cookie/csrf failure.
- **Rate-limit error:** `{ "error": "...too soon..." }` ⇒ wait and retry the POST with linear backoff (skygragon `++delay` seconds). [FROM-CLI]

### 4.3 Check / poll — `GET {base}/submissions/detail/{id}/check/`

No body. `{id}` = `submission_id` (submit) **or** `interpret_id` (run). Poll until terminal.

**`state` lifecycle:** `"PENDING"` → `"STARTED"` → `"SUCCESS"`. (`"FAILURE"` is also terminal — rare judge/system failure; night-slayer18 treats it as terminal.)

Non-terminal body is minimal, often just `{ "state": "PENDING" }`. Keep polling while `state ∈ {PENDING, STARTED}`.

**Result fields when `state == "SUCCESS"`** (union of submit + run modes):

| Field | Type | Meaning | Present in |
|---|---|---|---|
| `state` | string | `"SUCCESS"` / `"FAILURE"` | always |
| `status_code` | int | judge result (see table below) | always |
| `status_msg` | string | human label | always |
| `run_success` | bool | code ran without crash/compile-fail | always |
| `status_runtime` | string | e.g. `"52 ms"` / `"N/A"` | submit, run |
| `status_memory` | string | e.g. `"16.5 MB"` | submit |
| `memory` | int | raw bytes | submit |
| `total_correct` | int | testcases passed | submit, run |
| `total_testcases` | int | total testcases | submit, run |
| `runtime_percentile` | float\|null | "faster than X%" | submit, code 10 |
| `memory_percentile` | float\|null | "less than X%" | submit, code 10 |
| `compare_result` | string | per-case `"1"`/`"0"` bitstring, e.g. `"111011"` | submit |
| `code_answer` | string \| string[] | YOUR output per testcase | run |
| `expected_code_answer` | string \| string[] | expected output per testcase | run (from `interpret_expected_id`) |
| `correct_answer` | bool | run passed ALL testcases | run |
| `code_output` | string \| string[] | program stdout | run / submit |
| `std_output` / `std_output_list` | string \| string[] | stdout capture | varies |
| `expected_output` | string | expected output of failing case | submit, code 11 |
| `last_testcase` | string | the failing input | submit, code 11 / run errors |
| `input` | string | offending input | run errors |
| `runtime_error` / `full_runtime_error` | string | runtime error text | code 15 |
| `compile_error` / `full_compile_error` | string | compile error text | code 20 |
| `question_id` | string | echoed internal id | submit (leetgo distinguishes submit vs run results by its presence) |
| `pretty_lang` / `lang` | string | display language | submit |
| `task_finish_time` / `elapsed_time` | int | timing (ms) | varies |
| `finished` | bool | judge finished | varies |

**⚠ STRING-OR-ARRAY duality:** `code_answer`, `code_output`, `expected_output`, `std_output` may be a single string OR a `string[]` depending on `judge_type`. clearloop wrote a custom "string-or-sequence" deserializer for this. **Parsers MUST tolerate both.** [FROM-CLI]

### 4.4 `status_code` integer table  [FROM-CLI — skygragon `helper.js` + clearloop `models.rs`, agree]

| code | status_msg | category |
|---|---|---|
| **10** | Accepted | success (see subtlety below) |
| **11** | Wrong Answer | wrong |
| **12** | Memory Limit Exceeded (MLE) | limit |
| **13** | Output Limit Exceeded (OLE) | limit |
| **14** | Time Limit Exceeded (TLE) | limit |
| **15** | Runtime Error | error → read `full_runtime_error` |
| **16** | Internal Error | error |
| **20** | Compile Error | error → read `full_compile_error` |
| **21** | Unknown Error | error |
| default | Unknown | — |

**⚠ SUBTLETY — `status_code == 10` is NOT unconditional AC** [FROM-CLI — clearloop]:
- On a **Run/Test**: code 10 means passed only if `correct_answer == true`. code 10 + `correct_answer == false` = effectively Wrong Answer during testing.
- On a **Submit**: code 10 is real AC only with a non-empty `compare_result`.

### 4.5 Polling loop

**Recommended (night-slayer18 exponential backoff):**
```
endpoint    = GET {base}/submissions/detail/{id}/check/
maxAttempts = 12
initialDelay = 500ms, maxDelay = 3000ms
for attempt in 0 .. maxAttempts-1:
    result = GET endpoint            # JSON
    if result.state in {"SUCCESS", "FAILURE"}: return result
    delay = min(initialDelay * 2^attempt, maxDelay)   # 500,1000,2000,3000,3000,...
    sleep(delay)
throw timeout                        # ~30s total budget
```
- Terminal on `state ∈ {SUCCESS, FAILURE}`.
- Practical interval: ~1s, or exp backoff 0.5s→3s, cap ~10–15 attempts (~30s).
- ⚠ clearloop's literal `sleep(3000 microseconds)` is a bug (3ms tight loop) — do NOT copy it; use ~1s.
- On the run-code "too soon" POST rate-limit, linear-backoff and retry the POST (not the check).

### 4.6 End-to-end flow

**Test:** problem query (b) → get `questionId`, `exampleTestcases`, `codeSnippets` → POST `interpret_solution/` → `{interpret_id, interpret_expected_id}` → poll `check/{interpret_id}` until SUCCESS → read `code_answer`, `expected_code_answer`, `correct_answer`, `status_code`.

**Submit:** POST `submit/` → `{submission_id}` → poll `check/{submission_id}` until SUCCESS → on code 10 + non-empty `compare_result` = AC (with runtime/memory + percentiles); on 11 = WA (`total_correct`/`total_testcases`/`last_testcase`/`code_output`/`expected_output`); on 15 = RTE (`full_runtime_error`); on 20 = CE (`full_compile_error`).

---

## 5. Language Mapping

`codeSnippets: [{ lang, langSlug, code }]` — `lang` is the human display name, **`langSlug` is the stable machine id (key on THIS)**, `code` is the starter source.

**The submit/interpret `lang` body param == `langSlug` VERBATIM.** There is **NO remapping table** — leetgo passes the slug straight through. Only the FILE EXTENSION is a separate lookup. Apparent "mismatches" (Go→`golang`, Python3→`python3`, C#→`csharp`, Pandas→`pythondata`) are just the slug names, not remaps. [FROM-CLI — leetgo, HIGH]

**To generate a file for chosen language L:** `snippet = codeSnippets.find(s => s.langSlug === L)`. If absent, the problem doesn't offer L (e.g. SQL problems lack `cpp`) → error/fallback. Filename convention (clearloop): `{fid}.{slug}.{ext}`, e.g. `1.two-sum.py`. Write `snippet.code`.

**Input-alias normalization** (user types → wire slug): `go`/`golang` → `golang`; `python`/`py` → `python3`; `c#`/`cs` → `csharp`; `c++` → `cpp`; `sql` → `mysql` (default; pick `mssql`/`oraclesql`/`postgresql` from the problem's available snippets).

| langSlug | display | submit `lang` | file ext | line comment | confidence | notes |
|---|---|---|---|---|---|---|
| `cpp` | C++ | `cpp` | `.cpp` | `//` | HIGH | |
| `java` | Java | `java` | `.java` | `//` | HIGH | |
| `python` | Python | `python` | `.py` | `#` | HIGH | Python 2, legacy |
| `python3` | Python3 | `python3` | `.py` | `#` | HIGH | **use this for Python** |
| `pythondata` | Pandas | `pythondata` | `.py` | `#` | HIGH | pandas/DataFrame problems |
| `c` | C | `c` | `.c` | `//` | HIGH | |
| `csharp` | C# | `csharp` | `.cs` | `//` | HIGH | slug is `csharp`, not `cs`/`c#` |
| `javascript` | JavaScript | `javascript` | `.js` | `//` | HIGH | |
| `typescript` | TypeScript | `typescript` | `.ts` | `//` | HIGH | |
| `php` | PHP | `php` | `.php` | `//` | HIGH | |
| `swift` | Swift | `swift` | `.swift` | `//` | HIGH | |
| `kotlin` | Kotlin | `kotlin` | `.kt` | `//` | HIGH | |
| `dart` | Dart | `dart` | `.dart` | `//` | HIGH | |
| `golang` | Go | `golang` | `.go` | `//` | HIGH | slug is `golang`, not `go` |
| `ruby` | Ruby | `ruby` | `.rb` | `#` | HIGH | |
| `scala` | Scala | `scala` | `.scala` | `//` | HIGH | |
| `rust` | Rust | `rust` | `.rs` | `//` | HIGH | |
| `racket` | Racket | `racket` | `.rkt` | `;` | HIGH | |
| `erlang` | Erlang | `erlang` | `.erl` | `%` | HIGH | no real block comments |
| `elixir` | Elixir | `elixir` | `.exs` | `#` | HIGH | ⚠ ext: leetgo `.exs`, clearloop `.ex` — both run; LeetCode editor historically `.ex` |
| `bash` | Bash | `bash` | `.sh` | `#` | HIGH | shell problems |
| `mysql` | MySQL | `mysql` | `.sql` | `--` | HIGH | db problems |
| `mssql` | MS SQL Server | `mssql` | `.sql` | `--` | HIGH | db problems |
| `oraclesql` | Oracle | `oraclesql` | `.sql` | `--` | HIGH | db problems |
| `postgresql` | PostgreSQL | `postgresql` | `.sql` | `--` | MEDIUM-HIGH | LC-supported ~2024; valid slug, not in leetgo master snapshot |
| `cangjie` | 仓颉 / Cangjie | `cangjie` | `.cj` | `//` | **LOW** | **leetcode.cn ONLY** (Huawei, since 2024-09); in NONE of the 4 reference libs; `.cj` ext INFERRED — **verify against a live `.cn` codeSnippets before relying on it** |

**Unknown-slug fallback:** clearloop defaults to `.c`; prefer falling back to the `langSlug` itself or `.txt`.

---

## 6. leetcode.cn Differences (concise)

1. **Domain:** modern code uses `https://leetcode.cn`. Legacy `https://leetcode-cn.com` (skygragon 2018) only redirects — do NOT use it.
2. **GraphQL POST has a trailing slash** (`/graphql/`) vs `.com`'s `/graphql` (no slash).
3. **Second GraphQL endpoint** `/graphql/noj-go/` for `userContestRankingInfo`, `recentACSubmissions`, `userProgressQuestionList` (no `.com` equivalent).
4. **CSRF bootstrap differs:** `.cn` = POST `/graphql/` op `nojGlobalData` (`query nojGlobalData { siteRegion chinaHost websocketUrl }`), read `csrftoken` from `set-cookie`. `.com` = GET any page / `GET /graphql/`.
5. **Headers add** `accept: application/json` + `accept-language: zh-CN,zh;q=0.9,en;q=0.8`; `origin`/`referer` = `https://leetcode.cn`.
6. **Chinese content:** problem query populates `translatedTitle` + `translatedContent` (Chinese HTML); `content`/`title` hold English. Prefer `translated*` when non-null on `.cn` (the user's `useTranslation` flag governs site default).
7. **Strip `.com`-only fields** from the `.cn` problem query (`enableDebugger`, `envInfo`, `adminUrl`, `challengeQuestion`, `solution.paidOnly/hasVideoSolution/paidOnlyVideo`) or it errors.
8. **Problem list inner fields differ:** `.cn` uses `frontendQuestionId`/`paidOnly`/`titleCn`/`solutionNum`/`nameTranslated`; `.com` uses `questionFrontendId`/`isPaidOnly`/`hasSolution`/`hasVideoSolution` and nests under `data`/`totalNum`.
9. **Daily differs:** `.cn` op `questionOfToday`, field `todayRecord` is an **ARRAY (take `[0]`)**, no `link`; `.com` field `activeDailyCodingChallengeQuestion` is a single object with `link`.
10. **userStatus adds** `region`, `useTranslation`, `isPhoneVerified`/`isWechatVerified`/`isStaff`/`checkedInToday`; uses `userSlug`.
11. **Submission detail differs:** `.cn` SINGULAR `submissionDetail`, id type `ID!`, inline fragments on `GeneralSubmissionNode`/`ContestSubmissionNode`, aliased `runtime`/`memory`; `.com` PLURAL `submissionDetails`, id type `Int!`, flat fields, no fragments.
12. **Separate accounts/cookies** — `.cn` and `.com` sessions are NOT shared.
13. **REST run/submit/check path shape is IDENTICAL** — only the host swaps (`leetcode.cn` vs `leetcode.com`).
14. **`cangjie` (仓颉)** language exists ONLY on `.cn`.

---

## 7. Open Questions / Low-Confidence Items (need runtime verification with real credentials)

| # | Item | Why uncertain | How to verify |
|---|---|---|---|
| 1 | **`.com` GraphQL POST slash** — `/graphql` vs `/graphql/` | One report cites slash, VERBATIM source says no-slash for POST. | POST both forms with a real query; confirm no redirect drops the body. **Default to `/graphql` (no slash).** |
| 2 | **Submit body shape** — `judge_type:"large"` (skygragon/clearloop) vs `questionSlug`+no `judge_type` (leetgo) | CLIs send different bodies; both reportedly work. | Submit a real solution each way; confirm `submission_id` returned. Spec recommends `judge_type:"large"`. |
| 3 | **`question_id` type** — int vs string | skygragon `parseInt`, clearloop/night-slayer string; both said accepted. | Submit with each; confirm acceptance. (Low risk.) |
| 4 | **`QuestionListFilterInput` exact field names** — `searchKeywords`/`status`/`listId` | Only `difficulty`/`tags` are in recon; the rest are INFERRED from known schema. | Introspect the live schema or test each filter field. |
| 5 | **Hints-only minimal query** | No source has it; provided as a trim of the verbatim problem query (UNVERIFIED). | Run it live; or just request `hints` inside the full problem query. |
| 6 | **Random query** | No dedicated query exists in any source; must be done client-side via list+filter. | Confirm `skip`/`limit` pagination behaves; pick locally. |
| 7 | **`cangjie` ext `.cj`** + slug | `.cj` is INFERRED, n=0 samples; cangjie in none of the 4 libs. | Pull a live `.cn` codeSnippets for a cangjie-enabled problem; read actual `langSlug` + confirm ext. |
| 8 | **`elixir` ext** — `.exs` vs `.ex` | leetgo `.exs`, clearloop `.ex`; both run. | Cosmetic; pick `.exs` (leetgo) or `.ex`. No functional impact (submit `lang` is the slug, not the ext). |
| 9 | **`postgresql` slug** | LC-supported but not in leetgo master snapshot (MEDIUM-HIGH). | Fetch codeSnippets for a problem offering PostgreSQL; confirm slug `postgresql`. |
| 10 | **`interpret_expected_id` necessity** | skygragon polls it; others read `expected_code_answer` off the main result. | Compare: does `check/{interpret_id}` already contain `expected_code_answer`? If yes, skip the second poll. |
| 11 | **String-or-array fields** | Confirmed real but which `judge_type` triggers which form is unclear. | Empirically log `code_answer`/`code_output` shapes across run vs submit. Parser MUST tolerate both regardless. |
| 12 | **JSON-string fields needing double-parse** (`metaData`, `stats`, `companyTagStats`, `envInfo`, `similarQuestions`, `submissionCalendar`) | INFERRED from LeetCode behaviour, not from source asserting it. | Inspect a real response; `JSON.parse` the inner string. (Very likely correct.) |

---

## Confidence Summary

- **SOLID (VERBATIM source):** all GraphQL query strings (§3), GraphQL headers (§2.1), endpoint URLs and the `.com`-no-slash / `.cn`-slash distinction (§1), `.cn`-vs-`.com` schema field differences (§6), `codeSnippets` shape, `langSlug` = submit `lang` (no remap).
- **SOLID (FROM-CLI, 3–4 sources agree):** the REST run/submit/check flow (§4), `status_code` table, polling loop, REST headers incl. mandatory problem-page `Referer`, the mainstream langSlug→ext table.
- **NEEDS RUNTIME VERIFICATION:** items in §7 — chiefly submit-body variant, `QuestionListFilterInput` exact fields, `cangjie` ext, the no-dedicated-random/hints-query facts, and the JSON-double-parse fields. None block a first implementation; all are testable with one real authenticated round-trip each.
