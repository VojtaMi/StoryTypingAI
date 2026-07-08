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

`codex exec --full-auto` is a viable implementer for scoped, well-specified work. Two limits, both verified against `codex-cli 0.125.0` — do not re-derive them:

- **Codex cannot verify anything in a browser.** In `codex exec`, every MCP tool call is auto-cancelled (`user cancelled MCP tool call`), because the `exec_permission_approvals` feature is still under development. This holds regardless of `--full-auto`, `approval_policy`, or `--headless`. The `browser_use` / `computer_use` feature flags are enabled but surface no tool in `exec`.
- **Codex cannot bind a port** under the default `workspace-write` sandbox — `npm run dev:vite` fails with `listen EPERM`. Adding `-c sandbox_workspace_write.network_access=true` unblocks it, but that *also* grants model-run shell commands arbitrary outbound network access. Do not enable it casually.

Consequence: **Codex writes code; a browser-capable agent verifies UI.** Codex will report a page as done without ever having rendered it (it says so, but only in a trailing "Blocked" note). Never accept "it should render" — drive the page yourself.

When writing a delegation brief, **state the invariant, not the check.** A brief that says "remove the `as` cast" gets a removed cast; if nothing typechecks that directory, the unsoundness just moves. A brief that says "this must fail to compile if the value isn't validated" gets the real fix. Every defect that survived delegation in this repo landed exactly where a brief named a symptom instead of the property it protects.

## Deployment

Deployment to Rosti (rosti.cz) is documented in [`rosti/README.md`](./rosti/README.md). Consult it only when working on deployment tasks — it's not part of the general workflow.

## Playwright Screenshots

Playwright MCP is configured locally (`~/.claude.json`, not in this repo) with a custom `--output-dir` and `--headless`. Browser stays headless (no popup); for a debugging session needing headed mode, drop `--headless` and reconnect the MCP server.

**Never pass a bare/relative `filename` to `browser_take_screenshot`.** Despite the tool's own doc string, a relative filename resolves against the *current working directory* — i.e. the repo root — not the configured `--output-dir`. Verified against `@playwright/mcp@0.0.71`:

| `filename` argument | file lands in |
| --- | --- |
| omitted | `--output-dir` ✅ |
| `"shot.png"` (relative) | repo root ❌ |
| absolute path inside `--output-dir` | `--output-dir` ✅ |

So: **omit `filename`** and read the path from the tool result, or pass an absolute path under `--output-dir`. Absolute paths *outside* that dir are rejected.

`/*.png` is gitignored as a safety net, but a leaked screenshot is still a leaked screenshot — don't rely on it.
