---
name: delegate-to-codex
description: Hand a scoped implementation task to Codex as an implementer, then verify its work. Use when asked to delegate to codex, have codex implement or write something, act as orchestrator over codex, or generate images with codex. Covers writing the brief, the environment limits that make Codex silently unable to verify UI, and what to check before trusting its report.
---

# Delegating Implementation to Codex

Codex is a capable implementer for scoped, well-specified work. It is not a verifier you can trust on its word. This skill is how to get good work out of it and catch what it misses.

## Run it

Delegate through the `codex` Claude Code plugin, not a shell script:

```
Agent(subagent_type: "codex:codex-rescue", prompt: "<the brief>")
```

The user's equivalent is `/codex:rescue <request>`. Note the plugin's slash commands may not appear in the VS Code autocomplete picker — typing the full name still works.

What the rescue agent does with your prompt:

- **Defaults to `--write`** (sandbox `workspace-write`), so treat every delegation as "this will edit my working tree." Say "read-only", "review", or "diagnose" if you don't want edits.
- **Chooses foreground or background itself** — background for open-ended or multi-step work. Pass `--wait` or `--background` to force it.
- **Model passthrough**: `--model gpt-5.6-luna` (also `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.4-mini`). Left unset unless asked.
- **Can generate images** via Codex's built-in `image_gen` tool. Ask for the image and where to save it; generated files land in `~/.codex/generated_images/<session-id>/`.
- **Resumes prior work** with `--resume`; `--fresh` forces a new thread.

For a long brief, write it to a file and tell Codex to read that path — the agent forwards prompt text verbatim, so inline briefs get unwieldy.

Commit or stash first. Codex's changes land unstaged, and `git checkout -- <file>` will silently discard them.

`scripts/delegate-to-codex.sh` is deprecated. It passes `--full-auto`, which `codex exec` removed in codex-cli 0.147.0, so it fails immediately.

## Check network access before delegating UI work

The plugin only ever passes `sandbox: read-only` or `workspace-write` (`codex-companion.mjs:414,491`). It has **no way to request network access.** Without it Codex cannot bind a port, so `npm run dev:vite` dies with `listen EPERM` and Codex cannot render the page it just changed — and it will report the work as done anyway.

The old wrapper script passed this per-invocation. Under the plugin it must be in `~/.codex/config.toml`:

```toml
[sandbox_workspace_write]
network_access = true
```

The trade: this grants outbound network to every workspace-write Codex session on the machine, not just this one. If it isn't set, don't ask Codex to verify a page — verify it yourself instead.

A fresh git worktree also won't be in that file's `projects` trust map. Add a `trust_level = "trusted"` entry for the worktree path before delegating into it.

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

## Orchestration is yours, not the agent's

`codex:codex-rescue` is a thin forwarder. Its own instructions forbid it from inspecting the repo, monitoring progress, polling status, fetching results, or doing any follow-up. It makes one call and returns Codex's stdout.

So when you delegate:

- **Backgrounded jobs are yours to collect.** The agent will not poll. Retrieve them with `node "$CLAUDE_PLUGIN_ROOT/scripts/codex-companion.mjs" status` / `result`, or have the user run `/codex:status`. The agent is explicitly barred from calling those.
- **Every check in *Verify before you trust* is yours to run.** Nothing in the chain verifies on your behalf.
- **Split work into scoped subtasks yourself.** The agent does no decomposition.

## Environment limits

Re-verified 2026-08-12 against codex-cli 0.147.0 and codex plugin 1.0.6:

- **The plugin routes through `codex app-server`, not `codex exec`.** Flags documented for `exec` do not necessarily apply.
- **No network access unless `config.toml` grants it** — see above.
- **`codex exec` outside a git repo** needs `--skip-git-repo-check`.

Carried over from codex-cli 0.125.0 and **not** re-verified against the app-server path — confirm before relying on any of these:

- MCP tool calls were auto-cancelled under `codex exec` (`exec_permission_approvals` under development), so Codex could not drive Playwright through MCP. It could still drive a real browser from the shell via the `playwright` devDependency, which is what `scripts/verify-page.mjs` does.
- Writes were limited to the workdir, `/tmp`, and `$TMPDIR`. An `npx` needing `~/.npm/_cacache` failed with `EROFS`. Chromium in `~/.cache/ms-playwright` was readable but not writable — after a `playwright` upgrade, run `npx playwright install chromium-headless-shell` from a normal shell first. This is why `playwright` is pinned exactly.
- `git mv` could fail with a read-only `.git`; renames then landed as delete + add, which `git add -A` still detects.

## Verify before you trust

Codex's self-reports have been accurate about *what it did*. They are not evidence that what it did is correct. Check, in this order:

1. `npm run check` — yourself, not from its summary.
2. Grep for the thing it was told to delete. Suffixed shims and dead functions survive.
3. Mutation-test any new assertion: break the thing, confirm the test fails, restore it.
4. Open the page if the change has a UI surface.
5. Read the trailing "Blocked" section of its report. That is where it admits what it could not do.
