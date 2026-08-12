# Rosti deployment

This app deploys to [Rosti](https://rosti.cz), a Czech PaaS, as a Rosti
**app** — a Node runtime managed by supervisor. No Docker is involved.

The CLI is **`rosticli`** (not `rosti`).

Verified 2026-08-12 against `rosticli` 1.4.4 by deploying the Spanish reading
experiment to app 9220. The mechanism below is what actually ran; see
[What this branch still needs](#what-this-branch-still-needs) before deploying
*this* branch the same way.

## App versus stack

Rosti offers two things, and `rosticli` treats them very differently:

| | **App** (what we use) | Stack |
| --- | --- | --- |
| Runtime | Node + supervisor | docker-compose on a VM |
| Docker needed | No | Yes, daemon running locally |
| Created by | Rosti web admin — **not** in the CLI | `rosticli stacks init` |
| Deployed by | `rosticli apps info` + rsync + `rosticli apps ssh` | `rosticli push` |
| Administration | Simpler; smaller unit | Heavier |

`rosticli apps` exposes only `info`, `list`, and `ssh` — there is no
`apps create` and no one-command deploy. Creating the app is a web-admin step;
everything after that is scriptable.

## How the server runs your code

From `/srv/conf/supervisor.d/node.conf` on the app:

```ini
[program:app]
command=/srv/bin/primary_tech/npm start
directory=/srv/app
redirect_stderr=true
stdout_logfile=/srv/log/node.log
```

So: **`npm start`, with the working directory `/srv/app`.** nginx listens on
8000 and proxies to `127.0.0.1:8080`, so the process must bind **8080**.

Four consequences worth knowing before the first deploy — each one cost a
debugging round when it was found:

1. **`server.mjs` must sit directly beside `dist/`.** `src/server/production.ts`
   resolves its static root as `join(__dirname, "dist")`, not from the working
   directory. Put the built server anywhere else and it starts cleanly, logs
   "Listening on port 8080", and serves nothing at all. `npm run build` copies
   `dist-server/production.js` to `server.mjs` at the project root for exactly
   this reason — the same layout `rosti/Dockerfile` builds.
2. **`npm ci --omit=dev` needs `--ignore-scripts`.** The `prepare` script runs
   husky, a devDependency, which is absent under `--omit=dev` and fails the
   install with exit 127.
3. **`sharp` is native.** Never rsync `node_modules`; install on the server.
4. **`supervisorctl restart app` returns before the port is bound**, and the old
   process can briefly hold 8080. Poll the public URL until it serves rather
   than checking once.

## Secrets

The three provider keys live only in `/srv/app/.env`, created once and never
synced. Do **not** put `PORT` there — the `start` script pins it, and Node's
`--env-file` does not override an already-set variable.

```bash
scp -i "$(rosticli apps info --app-id <id> --json | sed -n '/^{/,/^}/p' \
  | node -e 'const c=[];process.stdin.on("data",d=>c.push(d));process.stdin.on("end",()=>console.log(JSON.parse(Buffer.concat(c).toString()).ssh_key))')" \
  -P <port> .env.local app@ssh.rosti.cz:/srv/app/.env
rosticli apps ssh --app-id <id> -- chmod 600 /srv/app/.env
```

`OPENAI_API_KEY`, `GEMINI_API_KEY`, and `ANTHROPIC_API_KEY`. Text generation is
OpenAI/Anthropic; narration, per-word pronunciation, and background images are
Gemini, so an OpenAI-only deploy serves text with no audio and no images.
(Anthropic is only needed for `claude-*` models.)

## Deploying

The deploy is a script, not a CLI command. Its shape:

```bash
rosticli apps info --app-id <id> --json   # ssh host/port/user/key, domains
npm run check && npm run build
rsync  dist/ → /srv/app/dist/             # --delete is safe, scoped to dist/
rsync  server.mjs package.json package-lock.json → /srv/app/
rosticli apps ssh -- npm --prefix /srv/app ci --omit=dev --ignore-scripts
rosticli apps ssh -- supervisorctl restart app
poll https://<domain>/ until it serves the page
```

### Never rsync the whole directory with `--delete`

The server writes its runtime data **inside `/srv/app`** — `stories/`,
`reading-openings/`, `openings/`, `learner/`, and the `word-audio/`,
`story-audio/`, and `story-images/` caches, all resolved from
`process.cwd()`. A whole-directory `rsync --delete` erases every saved story,
the prepared queue, the learner's adaptation state, and every cached provider
call, which is then paid for again.

Syncing the build paths individually keeps `--delete` scoped to `dist/`.

The alternative is to run the app with its working directory outside
`/srv/app`; nothing does that today.

### Useful afterwards

```bash
rosticli apps ssh --app-id <id> -- tail -30 /srv/log/node.log
rosticli apps ssh --app-id <id> -- supervisorctl status
rosticli apps ssh --app-id <id> -- supervisorctl stop app    # pause it
```

## Before the first deploy of this branch

The scripting is in place — `npm start`, the `server.mjs` copy in
`build:server`, and `scripts/deploy-rosti.sh`. Two steps remain, both one-time:

1. **Create the app** in the Rosti web admin (the CLI has no `apps create`) and
   note its id from `rosticli apps list`. Every Rosti app is a separate
   deployment; reusing another project's id replaces that deployment, which is
   why the script requires `ROSTI_APP_ID` and has no default.
2. **Create `/srv/app/.env`** with the provider keys, as above.

Then:

```bash
ROSTI_APP_ID=<id> bash scripts/deploy-rosti.sh
```

The script runs `npm run check` and `npm run build` first, refuses to continue
if `/srv/app/.env` is missing, and polls the public URL at the end rather than
reporting success on a restart that has not finished.

## No access control

The server has no authentication and no rate limiting. Anyone with the URL can
trigger story, image, and speech generation against the configured keys. For a
short-lived share, `supervisorctl stop app` between sessions and deleting the
app afterwards are the simplest mitigations.

## Alternative: deploying as a stack (unverified)

`Dockerfile` and `docker-compose.yml` in this folder support the stack path.
They are self-contained — nothing outside `rosti/` references them — and are
kept only as an option for a Docker host or a future multi-service setup.

Two things to resolve before relying on them:

- `rosticli push` uploads **`docker-compose.rosti.yml` from the project root**,
  while this folder holds `rosti/docker-compose.yml`. The file must be copied to
  the root, or the stack configured another way.
- The Dockerfile does `COPY . .`, so the **build context must stay the repo
  root**; point the Dockerfile setting at `rosti/Dockerfile` instead of setting
  `rosti/` as the context.

The compose file's env vars and volumes were corrected on 2026-08-12 to match
the current data layout, but the stack path itself has not been run since.
