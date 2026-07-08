---
name: delegate-to-codex
description: Hand a scoped implementation task to the Codex CLI as an implementer, then verify its work. Use when asked to delegate to codex, have codex implement or write something, act as orchestrator over codex, or run codex exec. Covers writing the brief, the sandbox limits that make Codex silently unable to verify UI, and what to check before trusting its report.
---

# Delegating Implementation to Codex

Codex is a capable implementer for scoped, well-specified work. It is not a verifier you can trust on its word. This skill is how to get good work out of it and catch what it misses.

## Run it

```bash
scripts/delegate-to-codex.sh brief.md
```

Do **not** invoke `codex exec` directly. The script exists because the flags are load-bearing — see *Sandbox limits* below. Codex runs in the repo root with no approval prompts, so treat every delegation as "this will edit my working tree."

Commit or stash first. Codex's changes land unstaged, and `git checkout -- <file>` will silently discard them.

## Write the brief as invariants, not checks

This is the single highest-leverage thing in this document. **Every defect that has survived a delegation in this repo landed exactly where the brief named a symptom instead of the property it protects.**

- ✗ "Remove the `as LessonGenerationSelection` cast." → the cast was removed; `scripts/` was in no tsconfig, so nothing typechecked it and the unsoundness just moved.
- ✓ "`scripts/` must be covered by `npm run check`; then the cast should be unnecessary."

- ✗ "Assert `parse(example)` equals the brick example." → derived exercise bricks have no `parse`, so their fixture could drift from `create()` unnoticed.
- ✓ "A brick's `example` must be exactly what the app renders; make drift fail a test."

For every requirement, ask: *what breaks if this is satisfied literally but not in spirit?* Write **that** as the success criterion, as a command whose failure is observable.

State known hazards and their resolution up front — a circular import, a registry that aliases keys to specs — or Codex will discover them mid-task and paper over them with `any` or a cast.

Finish the brief with: *"If a step is wrong or impossible as specified, STOP and explain rather than working around it."*

## Demand verification as a command

Codex will report a page as done without ever rendering it. It says so, but only in a trailing "Blocked" note that is easy to miss.

Put the verification in the brief, executable:

```bash
npm run dev:vite -- --port 5207 --strictPort &
sleep 4
npm run verify:page -- http://localhost:5207/bricks.html --expect-text "Lesson brick gallery"
```

`verify:page` exits non-zero on navigation failure, any console error, any uncaught page error, any failed request, or missing `--expect-text`.

For non-UI invariants, ask for mutation proof: *"Corrupt X, confirm the test fails, restore it, and report that you did."*

## Sandbox limits (verified — do not re-derive)

Against `codex-cli 0.125.0`:

- **MCP tools do not work.** Every MCP tool call in `codex exec` is auto-cancelled (`user cancelled MCP tool call`) because the `exec_permission_approvals` feature is under development. No flag changes this. So Codex cannot drive Playwright through MCP, and the enabled `browser_use` / `computer_use` flags surface no tool in `exec`.
- **It can still drive a real browser** — from the shell, via the `playwright` devDependency. That is what `scripts/verify-page.mjs` does.
- **It cannot bind a port** without `-c sandbox_workspace_write.network_access=true`; `npm run dev:vite` fails with `listen EPERM`. The wrapper script passes this. The trade is that model-run shell commands also get outbound network.
- **It can only write to the workdir, `/tmp`, and `$TMPDIR`.** An `npx` that must populate `~/.npm/_cacache` fails with `EROFS`. Anything Codex needs must resolve from `node_modules` or be pre-installed on the host. Chromium lives in `~/.cache/ms-playwright`, readable but not writable — if `playwright` is upgraded, run `npx playwright install chromium-headless-shell` from a normal shell first. This is why `playwright` is pinned exactly.
- **`git mv` may fail** (`.git` can be read-only in its sandbox). Renames then land as delete + add; `git add -A` still detects them.

## Verify before you trust

Codex's self-reports have been accurate about *what it did*. They are not evidence that what it did is correct. Check, in this order:

1. `npm run check` — yourself, not from its summary.
2. Grep for the thing it was told to delete. Suffixed shims and dead functions survive.
3. Mutation-test any new assertion: break the thing, confirm the test fails, restore it.
4. Open the page if the change has a UI surface.
5. Read the trailing "Blocked" section of its report. That is where it admits what it could not do.
