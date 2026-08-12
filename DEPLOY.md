# Deploying the Spanish experiment

This experiment is deployed to Rosti as an **app** (Node + supervisor). No
Docker is involved. Verified 2026-08-12 by deploying and reading a generated
story end to end.

- **App id:** 9220 (`AI_language_stories`, company 6725)
- **URL:** https://ai-language-stories-9220.rostiapp.cz/

The `rosti/` folder inherited from the `esperanto` branch describes the older
Docker/stack route; the mechanism and its traps are documented properly in
`rosti/README.md` on the `esperanto` branch, which is worth reading before
changing anything here.

## Redeploy

```bash
bash scripts/deploy-rosti.sh
```

The script verifies and builds, refuses to continue if `/srv/app/.env` is
missing, syncs only build output, installs production dependencies on the
server, restarts supervisor, and polls the public URL until it actually serves
the page.

`ROSTI_APP_ID` defaults to 9220 here; override it to target a different app.

## First-time setup on a new app

1. Create the app in the Rosti web admin — `rosticli` has no `apps create`.
2. Copy the provider keys up once (never committed, never rsynced):

   ```bash
   scp -i ~/.config/rosti/ssh/id_ed25519 -P <port> .env.local app@ssh.rosti.cz:/srv/app/.env
   rosticli apps ssh --app-id <id> -- chmod 600 /srv/app/.env
   ```

   `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and no `PORT` — the
   `start` script pins 8080, and Node's `--env-file` does not override a
   variable that is already set.

## Two things to remember

**Runtime data lives inside `/srv/app`.** `stories/`, `reading-openings/`,
`learner/`, and the audio and image caches are all resolved from
`process.cwd()`. The deploy script syncs the build paths individually so
`--delete` stays scoped to `dist/`; a whole-directory sync would erase every
saved story and re-bill every cached provider call.

**There is no authentication or rate limiting.** Anyone with the URL generates
against the configured keys. Pause the app between sessions and delete it when
the demo is over:

```bash
rosticli apps ssh --app-id 9220 -- supervisorctl stop app
rosticli apps ssh --app-id 9220 -- tail -30 /srv/log/node.log   # if something breaks
```

## Running it locally instead

Vite is on 5175 and the API on 3002 in this worktree, deliberately different
from the Esperanto app's 5173/3001 so the two never share a `localStorage`
origin during side-by-side testing.

```bash
npm run dev
```
