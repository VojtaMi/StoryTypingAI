# Rosti deployment

This app deploys to [Rosti](https://rosti.cz), a Czech PaaS. This folder
holds everything Rosti-specific so it stays out of the general project
instructions.

## Files

- `Dockerfile` — production multi-stage build (build the app, then copy the
  built output into a slim runtime image).
- `docker-compose.yml` — the compose file Rosti applies to run the deployed
  `app:latest` image, including the `saves`, `openings`, and `story-images`
  volumes and required env vars.
- `.rostistate` — local state written by the `rosti` CLI (company/stack IDs,
  SSH access). Gitignored; do not commit.

## Build context

The Dockerfile does `COPY . .`, so the **Docker build context must stay the
repo root** even though the Dockerfile itself now lives in `rosti/`. When
configuring the build on Rosti's side, point the Dockerfile path setting at
`rosti/Dockerfile` — don't set `rosti/` as the build context.

## Deploying

<!-- TODO: fill in the actual `rosti` CLI command(s) used to deploy, e.g.
     whether it's run from this folder or the repo root. -->
