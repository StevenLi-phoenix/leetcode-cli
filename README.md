# leetcode-cli

A minimal LeetCode CLI for terminal-driven problem solving. No TUI, no remote backend, no native dependencies — just `list`, `show`, `pick`, `test`, `submit`, and a few quality-of-life extras. Solve in your own editor; drive everything from the shell.

Installs two equivalent commands: **`leetcode`** and **`leetcode-cli`**.

```text
$ leetcode list -d easy -n 5
     1  Easy    57.7%  Two Sum
     9  Easy    60.7%  Palindrome Number
    13  Easy    66.8%  Roman to Integer
    14  Easy    47.8%  Longest Common Prefix
    20  Easy    44.4%  Valid Parentheses

$ leetcode pick 1 --lang python3
✔ Created ./problems/1.two-sum.py
Language: python3  ·  id: 1  ·  two-sum

$ leetcode test 1        # run the example cases
$ leetcode submit 1      # submit to the judge
 Accepted   Cases: 57/57   Runtime: 52 ms (beats 91.2%)   Memory: 16.5 MB (beats 60.1%)
```

## Install

Requires **Node.js ≥ 20**.

```bash
pnpm install
pnpm build
pnpm link --global    # exposes `leetcode` and `leetcode-cli`
```

Or run without linking: `node dist/index.js <command>`.

## Authentication

LeetCode has no public API, so the CLI reuses your browser session. Copy two cookies from your browser (DevTools → Application → Cookies → `https://leetcode.com`):

- `LEETCODE_SESSION`
- `csrftoken`

Then either log in interactively (values are stored locally via [`conf`](https://github.com/sindresorhus/conf)):

```bash
leetcode login
# or non-interactively:
leetcode login --session "<LEETCODE_SESSION>" --csrf "<csrftoken>"
```

…or set environment variables (these take precedence over stored credentials — handy for CI):

```bash
export LEETCODE_SESSION=...
export LEETCODE_CSRF_TOKEN=...
```

Reading problems, listing, and the daily challenge work anonymously; `whoami`, `test`, and `submit` need credentials.

## Commands

| Command | Description |
|---|---|
| `login` / `logout` / `whoami` | Manage and inspect your session |
| `list` (`ls`) | Browse/filter problems: `-d <easy\|medium\|hard>`, `-t <tag...>`, `-s <search>`, `-c <category>`, `--status <unsolved\|solved\|attempted>` (needs login), `-n <limit>`, `-p <page>` |
| `show <id>` | Render a problem statement (`-x` to include hints) |
| `hint <id>` | Show hints (`-n <k>` for a single one) |
| `pick <id>` | Generate a solution file (`-l <lang>`, `-f` force, `--show`, `--open`) |
| `test <target>` | Run against example or custom (`-c`) test cases |
| `submit <target>` | Submit to the judge |
| `daily` | Today's daily challenge (`-p` to also pick it) |
| `random` (`rand`) | A random problem (`-d`, `-t`, `--status`, `-p`) — e.g. `random --status unsolved` |
| `timer [id]` | Interview-style countdown (`-m <min>`, `--stats`) |
| `snapshot <action> <target> [label]` | Local versioning: `save` / `list` / `diff` / `restore` |
| `config [key] [value]` | View/set `site`, `lang`, `workdir`, `editor` |

`<id>` accepts either a problem's frontend number (`1`) or its slug (`two-sum`).
`<target>` for `test`/`submit` accepts an id/slug or a solution file path.

### Solution files

`pick` writes files under your workdir (defaults to the current directory; set a fixed one with `config workdir`), organized as:

```
{workdir}/problems/{id}.{slug}.{ext}
```

e.g. `./problems/1.two-sum.py`. Each file begins with a one-line metadata comment so `test`/`submit` can recover the problem id, language, and slug automatically — just point them at the file (or the problem id) after editing.

### Configuration

```bash
leetcode config                      # show all settings + config file path
leetcode config lang cpp             # default language for `pick`
leetcode config workdir ~/lc         # where solution files live
leetcode config editor "code -w"     # used by `pick --open`
leetcode config site leetcode.cn     # switch to the China site
```

## leetcode.cn support

Pass `--site leetcode.cn` on any command, or set it permanently with `leetcode config site leetcode.cn`. The CLI adapts the GraphQL queries, prefers translated titles/statements, and uses the `.cn` daily endpoint. Credentials are stored per-site (the two sites are separate accounts).

## Non-Goals

- No TUI mode — use your own editor.
- No remote collaboration / third-party backend.
- No native modules (no keytar).
- No workspace / git-sync features.

## Development

```bash
pnpm typecheck     # tsc --noEmit
pnpm test          # node --test (via tsx)
pnpm build         # bundle to dist/ with tsup
pnpm dev           # watch build
```

## Tech Stack

TypeScript + ESM, bundled with tsup. Node ≥ 20 native `fetch`. `commander` (CLI), `chalk` (colour), `ora` (spinners), `conf` (config/credentials), `zod` (response validation), `diff` (snapshots), `marked` + `marked-terminal` (markdown).

## License

MIT
