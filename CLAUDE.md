# Project Instructions

This is the canonical instruction file for AI coding agents working in this repository.

## External Dependencies

When working with any external API or library, prefer current implementations over training-data defaults — they drift toward legacy versions. Use Context7 to check current docs before writing new code or updating existing usage.

If adopting the current API/version would require changes to the existing codebase, flag that to the user before proceeding.

Before finishing code changes, run:

```bash
npm run check
```

For lint-only or style-only changes, run:

```bash
npm run lint
```

Use Biome warnings as useful feedback. Do not weaken rules just to silence React hook dependency warnings unless there is a documented reason.

The commit hook runs Biome on staged files, so keep changes passing:

```bash
npm run lint:staged
```

## LLM Generation Code

When a single LLM call generates multiple distinct structured items (e.g. a lesson made of several exercise types), give each item type a self-contained spec — its own prompt-shape fragment, its own authoring instructions, and its own parser — instead of one hardcoded monolithic prompt string plus one big parser. The orchestrator should just compose specs and dispatch parsing per item. See `src/storyRecap.ts` (`RecapExerciseSpec`) for the pattern.

When part of an LLM's output must satisfy a structural invariant (e.g. "this sentence must not contain this word" so the app can render a blank), don't rely on a prompt instruction the model might ignore, and don't just validate-and-reject after the fact either — shrink what you ask the LLM for and derive the invariant deterministically in code. Example: ask for one natural sentence containing the word, then split on it client-side, rather than asking the LLM to pre-split the sentence around the word itself.

## Delegating Implementation to Codex

`codex exec --full-auto` is a viable implementer for scoped, well-specified work. Always invoke it with network access so it can verify its own UI changes:

```bash
codex exec --full-auto -c 'sandbox_workspace_write.network_access=true' - < brief.md
```

Facts verified against `codex-cli 0.125.0` and `@playwright/mcp@0.0.71` — do not re-derive them:

- **Codex cannot use MCP tools.** In `codex exec`, every MCP tool call is auto-cancelled (`user cancelled MCP tool call`), because the `exec_permission_approvals` feature is still under development. This holds regardless of `--full-auto`, `approval_policy`, or `--headless`. So Codex cannot drive Playwright *through MCP*, and the enabled `browser_use` / `computer_use` feature flags surface no tool in `exec`.
- **Codex can drive a real browser from the shell.** `scripts/verify-page.mjs` uses the `playwright` devDependency directly, so it sidesteps MCP entirely. Codex runs it happily.
- **Codex needs `network_access=true` to bind a port.** Without it, `npm run dev:vite` fails with `listen EPERM`. The flag also grants model-run shell commands outbound network access — that is the accepted trade for self-verifying delegations.
- **Codex's sandbox can only write to the workdir, `/tmp`, and `$TMPDIR`.** An `npx` that must populate `~/.npm/_cacache` fails with `EROFS`. Anything Codex needs must resolve from the repo's `node_modules` (as `playwright` now does) or be pre-installed on the host. Chromium lives in `~/.cache/ms-playwright`, which Codex can read but not write — if Playwright is upgraded, run `npx playwright install chromium-headless-shell` from a normal shell first.

So a delegation brief should ask for verification as a command, not a promise:

```bash
npm run dev:vite -- --port 5207 --strictPort &
sleep 4
npm run verify:page -- http://localhost:5207/bricks.html --expect-text "Lesson brick gallery"
```

`verify:page` exits non-zero on navigation failure, any console error, any uncaught page error, any failed request, or a missing `--expect-text`, and writes a screenshot to the gitignored `.artifacts/verify/`. Before this existed, Codex twice shipped a page it had never rendered — reporting so only in a trailing "Blocked" note.

When writing a delegation brief, **state the invariant, not the check.** A brief that says "remove the `as` cast" gets a removed cast; if nothing typechecks that directory, the unsoundness just moves. A brief that says "this must fail to compile if the value isn't validated" gets the real fix. Every defect that survived delegation in this repo landed exactly where a brief named a symptom instead of the property it protects.

## Deployment

Deployment to Rosti (rosti.cz) is documented in [`rosti/README.md`](./rosti/README.md). Consult it only when working on deployment tasks — it's not part of the general workflow.

## Playwright Screenshots

Playwright MCP is configured locally (`~/.claude.json`, not in this repo) with a custom `--output-dir` and `--headless`. Browser stays headless (no popup); for a debugging session needing headed mode, drop `--headless` and reconnect the MCP server.

Despite the tool's own doc string, a relative `filename` resolves against the *current working directory* — the repo root — not the configured `--output-dir`. Verified against `@playwright/mcp@0.0.71`:

| `filename` argument | writes to |
| --- | --- |
| omitted | `--output-dir` |
| `"shot.png"` (relative) | **the repo root** |
| any absolute path (inside `--output-dir` or not) | that path, creating no directories |

You don't have to remember this. A `PreToolUse` hook ([`.claude/hooks/screenshot-to-artifacts.mjs`](./.claude/hooks/screenshot-to-artifacts.mjs), wired up in [`.claude/settings.json`](./.claude/settings.json)) rewrites any relative `filename` to `.artifacts/screenshots/<name>`, creating the directory. `.artifacts/` is gitignored, and it is where `npm run verify:page` puts its screenshots too. Absolute paths pass through untouched; a relative path that escapes `.artifacts/screenshots` is denied.

So just pass `filename: "gallery.png"` and read the real path back from the tool result.

`/*.png` is also gitignored as a belt-and-braces net — the hook only guards this repo's Claude Code sessions, not other tools.
