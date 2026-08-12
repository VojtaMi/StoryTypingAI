#!/usr/bin/env bash
# Deploy the German reading experiment to the Rosti *app* (not a stack).
#
# Rosti runs `npm start` under supervisor with cwd /srv/app, and nginx proxies
# to 127.0.0.1:8080 — so package.json's `start` script pins PORT=8080.
#
# Only build output is synced. The server writes its runtime data (stories/,
# reading-openings/, learner/, and the audio and image caches) *inside*
# /srv/app, so a whole-directory `rsync --delete` would erase the learner's
# stories and force every cached provider call to be paid again. Syncing the
# four build paths individually keeps --delete scoped to those paths.
set -euo pipefail

if [[ -z "${ROSTI_APP_ID:-}" ]]; then
	echo "Deployment stopped: ROSTI_APP_ID must be set explicitly; no German Rosti app id is configured." >&2
	exit 1
fi
APP_ID="$ROSTI_APP_ID"
REMOTE_APP_DIR=/srv/app

connection_json="$(rosticli apps info --app-id "$APP_ID" --json | sed -n '/^{/,/^}/p')"
read -r ssh_host ssh_port ssh_user ssh_key < <(
  node -e '
    const chunks = []
    process.stdin.on("data", (chunk) => chunks.push(chunk))
    process.stdin.on("end", () => {
      const info = JSON.parse(Buffer.concat(chunks).toString())
      console.log(info.ssh_host, info.ssh_port, info.ssh_user, info.ssh_key)
    })
  ' <<<"$connection_json"
)
rsync_ssh="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i $ssh_key -p $ssh_port"
remote="$ssh_user@$ssh_host"

echo 'Verifying and building the release…'
npm run check
npm run build

# The API keys live only in /srv/app/.env on the server; it is never synced.
echo 'Checking the server has its environment file…'
if ! rosticli apps ssh --app-id "$APP_ID" -- test -f "$REMOTE_APP_DIR/.env"; then
  cat >&2 <<'MISSING'
Deployment stopped: /srv/app/.env is missing on the server.

Create it once, with the three provider keys (no PORT — the start script sets it):

  rosticli apps ssh --app-id <id> -- sh -lc 'cat > /srv/app/.env' <<'EOF'
  OPENAI_API_KEY=...
  GEMINI_API_KEY=...
  ANTHROPIC_API_KEY=...
  EOF
MISSING
  exit 1
fi

# The server resolves its static root as `join(__dirname, "dist")`, so
# server.mjs must sit directly beside dist/ — the same layout the Dockerfile
# builds. `npm run build` emits server.mjs at the repo root for this reason.
echo "Syncing build output to Rosti app $APP_ID…"
rsync -az --delete -e "$rsync_ssh" dist/ "$remote:$REMOTE_APP_DIR/dist/"
rsync -az -e "$rsync_ssh" server.mjs package.json package-lock.json "$remote:$REMOTE_APP_DIR/"

echo 'Installing production dependencies and restarting…'
# sharp is a native module, so it is installed on the server, never rsynced.
# --ignore-scripts matches rosti/Dockerfile: the `prepare` script runs husky,
# which is a devDependency and therefore absent under --omit=dev.
rosticli apps ssh --app-id "$APP_ID" -- npm --prefix "$REMOTE_APP_DIR" ci --omit=dev --ignore-scripts
rosticli apps ssh --app-id "$APP_ID" -- supervisorctl restart app

echo 'Waiting for the app to answer…'
domain="$(node -e '
  const chunks = []
  process.stdin.on("data", (chunk) => chunks.push(chunk))
  process.stdin.on("end", () => {
    const info = JSON.parse(Buffer.concat(chunks).toString())
    console.log(String(info.domains).split(",")[0].trim())
  })
' <<<"$connection_json")"

# `supervisorctl restart` returns before the new process has bound its port, and
# the previous process can still hold 8080 for a moment — so poll until the page
# is genuinely served rather than trusting one request. Checked explicitly with
# an `if`: a failing curl inside a pipeline once let this script report success.
deadline=$((SECONDS + 90))
while :; do
  if body="$(curl --fail --silent --max-time 10 "https://$domain/" 2>/dev/null)" &&
    printf '%s' "$body" | grep -q 'id="root"'; then
    break
  fi
  if ((SECONDS >= deadline)); then
    echo "Deployment failed: https://$domain/ did not serve the app within 90s." >&2
    echo "Check: rosticli apps ssh --app-id $APP_ID -- tail -30 /srv/log/node.log" >&2
    exit 1
  fi
  sleep 3
done
echo "Deployment complete: https://$domain/"
