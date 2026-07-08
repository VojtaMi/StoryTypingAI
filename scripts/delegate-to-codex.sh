#!/usr/bin/env bash
#
# Hand a written brief to Codex as an implementer.
#
#   scripts/delegate-to-codex.sh brief.md
#   scripts/delegate-to-codex.sh < brief.md
#
# The flags are the point. `codex exec` defaults to a sandbox that cannot bind a
# listening socket, so `npm run dev:vite` dies with `listen EPERM` and Codex
# cannot render the page it just changed — it will report the work as done
# anyway. `network_access=true` is what lets it run the dev server and verify
# itself with `npm run verify:page`.
#
# The trade: model-run shell commands also get outbound network access.
#
# See .claude/skills/delegate-to-codex/SKILL.md for how to write the brief.
set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
	echo "codex CLI not found on PATH." >&2
	exit 127
fi

repo_root="$(git rev-parse --show-toplevel)"

if [ "$#" -gt 0 ]; then
	if [ ! -f "$1" ]; then
		echo "Brief not found: $1" >&2
		exit 2
	fi
	exec codex exec --full-auto \
		-c 'sandbox_workspace_write.network_access=true' \
		-C "$repo_root" - <"$1"
fi

if [ -t 0 ]; then
	echo "Pass a brief file, or pipe one on stdin." >&2
	exit 2
fi

exec codex exec --full-auto \
	-c 'sandbox_workspace_write.network_access=true' \
	-C "$repo_root" -
