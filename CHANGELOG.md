# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- CI workflow running typecheck + test + build on every push to `main` and every pull request, across Node 20 and 22.
  Files: .github/workflows/ci.yml

### Changed
- Bumped the release workflow's actions to their Node 24 runtime versions (`actions/checkout@v5`, `actions/setup-node@v6`, `pnpm/action-setup@v6`, `softprops/action-gh-release@v3`) to clear GitHub's Node 20 deprecation warning.
  Files: .github/workflows/release.yml
- Documented the release and CI workflows: added npm + CI badges and a "Releasing" section to the README, and a "Release & CI" section to the project CLAUDE.md.
  Files: README.md, CLAUDE.md

## [0.1.0] - 2026-06-25 — Initial release

### Added
- `pull` command to download your accepted submissions into local `problems/{id}.{slug}.{ext}` files (with the `@leetcode` header): `pull <id>` for one problem — preferring your configured language and falling back to any accepted language — and `pull --all` to import every solved problem (one file each), plus `-l/--lang` (strict language) and `-f/--force`. Adapts to the `.com`/`.cn` submission GraphQL (offset vs `lastKey` paging, `Int!` vs `ID!`, `lang` object vs string).
  Files: src/commands/pull.ts, src/api/client.ts, src/api/queries.ts, src/api/schemas.ts, src/lib/submissions.ts, src/index.ts
- Tests for submission schemas, the `pickAcSubmission`/`writeSolution` helpers, and the client's submission methods (paging, prefer-with-fallback, soft-throttle retry).
  Files: test/pull.test.ts, test/client-submissions.test.ts, test/schemas.test.ts
- Tag-triggered release workflow that publishes to npm via OIDC Trusted Publishing (no tokens, provenance enabled), to GitHub Packages, and creates a GitHub Release with the packed tarball; each publish is idempotent (skips a version already on the registry).
  Files: .github/workflows/release.yml, package.json
- Documented the three install paths (npm, GitHub Packages, GitHub Release tarball) in the README.
  Files: README.md

### Changed
- Extracted `writeSolution` (solution path + `@leetcode` header + manifest entry) from `pick` so `pick` and `pull` share one write path.
  Files: src/commands/pick.ts
- Scoped the published package to `@stevenli-phoenix/leetcode-cli` (the unscoped name is taken on npm; the `leetcode`/`leetcode-cli` commands are unchanged) and added `repository`/`bugs`/`homepage`, `publishConfig.access=public`, a pinned `packageManager`, and a `prepublishOnly` build guard.
  Files: package.json

### Fixed
- `pull` retries LeetCode's submission-detail soft-throttle — an HTTP-200 response with a `null` detail that the 429/503 retry can't see — with its own backoff, so `pull --all` survives hundreds of rapid fetches.
  Files: src/api/client.ts
