# leetcode-cli

A minimal LeetCode CLI for terminal-driven problem solving. No bloat, no remote backends, no native dependencies.

## Planned Features

- Cookie-based auth (stored locally via `conf`)
- `lc list` — browse/filter problems by difficulty, tags, status
- `lc show <id>` — display problem description
- `lc pick <id>` — generate solution file with function signature
- `lc test <id>` — run against sample test cases
- `lc submit <id>` — submit to LeetCode
- `lc daily` — today's challenge
- `lc timer <id>` — local interview timer with stats
- `lc snapshot` — save/restore/diff solution versions
- leetcode.cn support

## Non-Goals

- No TUI mode
- No remote collaboration (no Supabase)
- No native modules (no keytar)
- No workspace/git-sync features

## Tech Stack

- TypeScript + tsup
- Node.js >= 20 (native fetch)
- `commander` + `chalk` + `ora`
- `conf` for config/credential storage
- `zod` for API response validation
