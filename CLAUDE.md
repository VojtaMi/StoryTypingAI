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

## Story Architecture

Typing stories and reading stories have different lifecycles. Typing stories are interactive continuations; reading stories use a finite prepared-reading workflow, where a complete story is generated once and the session only reveals its sections. Keep their orchestration separate unless a task explicitly changes both.

See [`docs/architecture.md`](./docs/architecture.md) for the responsibility areas and both lifecycles, and [`docs/ai-workflows.md`](./docs/ai-workflows.md) for who owns each AI operation.

## LLM Generation Code

When a single LLM call generates multiple distinct structured items (e.g. a lesson made of several exercise types), give each item type a self-contained spec — its own prompt-shape fragment, its own authoring instructions, and its own parser — instead of one hardcoded monolithic prompt string plus one big parser. The orchestrator should just compose specs and dispatch parsing per item. See `src/storyRecap.ts` (`RecapExerciseSpec`) for the pattern.

When part of an LLM's output must satisfy a structural invariant (e.g. "this sentence must not contain this word" so the app can render a blank), don't rely on a prompt instruction the model might ignore, and don't just validate-and-reject after the fact either — shrink what you ask the LLM for and derive the invariant deterministically in code. Example: ask for one natural sentence containing the word, then split on it client-side, rather than asking the LLM to pre-split the sentence around the word itself.

## Development-Phase Compatibility

This project is still under active development. Do not add migrations,
compatibility adapters, fallback code, or legacy schema support for obsolete
local saves, prepared queues, or generated artifacts unless the user explicitly
requests it.

Prefer the simplest current data model. Runtime-generated development data may
be discarded and regenerated after schema changes. Do not delete local user
data automatically; report when existing data has become unsupported.

## Verifying UI Changes

A change with a UI surface is not done until the page has been rendered. `npm run verify:page -- <url> [--expect-text "..."]` drives a real browser and exits non-zero on navigation failure, any console error, any uncaught page error, any failed request, or missing text. Screenshots go to the gitignored `.artifacts/`.

Before running `npm run dev`, check whether it's already running (`ss -ltnp | grep -E ':(3001|5173)'`). This repo's dev server is often left running across sessions; starting a second instance fails on `EADDRINUSE` for the API port (3001) while silently spawning a duplicate Vite instance on the next port up.

Clean up what you start, don't disturb what you found: if a server was already running, use it and leave it; if you start one yourself, stop it when the task is done rather than leaving it for the user to discover. Kill the specific process group you started (`kill -- -<pgid>` — Vite and the API share one) or kill by port (`kill $(ss -ltnp 'sport = :5173 or sport = :3001' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)`), never a broad `pkill`.

## Delegating Implementation to Codex

Use the `delegate-to-codex` skill, and run it via `scripts/delegate-to-codex.sh`. Codex's sandbox flags are load-bearing: without them it cannot render the page it just changed, and will report the work as done anyway.

## Deployment

Deployment to Rosti (rosti.cz) is documented in [`rosti/README.md`](./rosti/README.md). Consult it only when working on deployment tasks — it's not part of the general workflow.
