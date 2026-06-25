# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `pull` command to download your accepted submissions into local `problems/{id}.{slug}.{ext}` files (with the `@leetcode` header): `pull <id>` for one problem — preferring your configured language and falling back to any accepted language — and `pull --all` to import every solved problem (one file each), plus `-l/--lang` (strict language) and `-f/--force`. Adapts to the `.com`/`.cn` submission GraphQL (offset vs `lastKey` paging, `Int!` vs `ID!`, `lang` object vs string).
  Files: src/commands/pull.ts, src/api/client.ts, src/api/queries.ts, src/api/schemas.ts, src/lib/submissions.ts, src/index.ts
- Tests for submission schemas, the `pickAcSubmission`/`writeSolution` helpers, and the client's submission methods (paging, prefer-with-fallback, soft-throttle retry).
  Files: test/pull.test.ts, test/client-submissions.test.ts, test/schemas.test.ts

### Changed
- Extracted `writeSolution` (solution path + `@leetcode` header + manifest entry) from `pick` so `pick` and `pull` share one write path.
  Files: src/commands/pick.ts

### Fixed
- `pull` retries LeetCode's submission-detail soft-throttle — an HTTP-200 response with a `null` detail that the 429/503 retry can't see — with its own backoff, so `pull --all` survives hundreds of rapid fetches.
  Files: src/api/client.ts
