# Esperanto practice

An AI Esperanto learning app built around tiny stories. It has two distinct
story workflows plus a lesson curriculum:

- **Typing stories** — an open-ended collaboration. The AI writes a passage, you
  type it as a typing exercise, then you author your own continuation and the AI
  builds on it. This can go on indefinitely.
- **Reading stories** — a finite six-part story adapted to your learner profile.
  You read each section with narration and a generated background image, tap
  words you don't know, and finish with a short recap quiz.
- **Lessons** — a hand-authored curriculum plus AI-generated lessons, assembled
  from reusable exercise "bricks".

React 19 + TypeScript + Vite in the browser, with a small Node HTTP server that
owns every AI provider call and all local data. In development, Vite proxies
`/api/*` to that server.

## How it works

### Typing stories

1. Start a typing story from the main menu.
2. The session consumes a **prepared opening** from a background queue, or
   generates one on the spot if the queue is empty.
3. You type the AI's passage — live WPM, accuracy, elapsed time, and mistake
   count update as you go.
4. When you finish, you write your own continuation in your own words.
5. The AI reads your continuation and writes the next passage, which becomes the
   next typing target.
6. Repeat for as long as you like. There is no ending: the story is a
   conversation, and older turns are folded into a rolling summary so it stays
   coherent as the history grows.

### Reading stories

1. Start a reading story from the main menu.
2. The session consumes a **complete prepared story** from a background queue.
   All six sections already exist — written in one generation call against your
   learner profile, your preferences, and the story memory that keeps stories
   from repeating themselves.
3. You read section 1, with narration and a background image. Tapping a word
   shows its translation and can pronounce it.
4. "Continue" reveals the next section. **No prose is generated while you read**:
   the session moves a cursor through the story it already has, and the narration
   and image for the next section are prepared in the background while you read
   the current one.
5. After the last section, a short recap quiz is generated from the story.
6. Your word lookups, recap answers, and optional difficulty feedback are folded
   back into your learner profile, and the story's motifs into the story memory,
   so the next story is pitched better and is about something else.

The two workflows do **not** share a generation lifecycle — see
[docs/architecture.md](./docs/architecture.md).

## Features

- **Learner language profile** — a one-page handout the AI maintains about what
  you know, what you are currently learning, and what you are shaky on. Reading
  stories are written against it.
- **Learner preferences and story memory** — durable taste (tone, audience fit,
  disliked motifs) and anti-repetition memory, so stories stay varied.
- **Narration** — every reading section is narrated; the voice is picked per
  story.
- **Generated background images** — odd-numbered sections get their own image,
  with a hidden visual-continuity description that keeps the character and place
  stable across the story.
- **Word lookups** — tap a word for its translation and pronunciation. Lookups
  are logged as evidence about what you don't know yet.
- **Recap lessons** — a three-exercise quiz generated from the finished story.
- **Esperanto tutor chat** — an in-story chat bot; what you ask it refines your
  profile and preferences.
- **Prepared queues** — the next typing opening and the next complete reading
  story are generated in the background, so starting one is instant.
- **Local persistence** — stories, learner data, and generated media are written
  to the working directory as plain files; see
  [docs/local-data.md](./docs/local-data.md).

## Getting started

```bash
npm install

# Server-side keys, never sent to the browser:
echo 'OPENAI_API_KEY=sk-...' > .env.local

npm run dev      # API server (port 3001) + Vite dev server
npm run build    # type-check and build the client and server bundles
npm run preview  # preview the production client build
```

### Environment variables

The dev API server reads `.env.local` (via `--env-file-if-exists`). `.env.local`
is git-ignored through `*.local` — never commit your keys.

| Variable | Required | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | `gpt-*` text models, background images, lesson audio, and story narration when no Gemini key is set. |
| `ANTHROPIC_API_KEY` | Only for Claude | Needed to run a `claude-*` model; those calls fail without it. |
| `GEMINI_API_KEY` | Only for Gemini | Needed to run a `gemini-*` model. When it is set, story narration also switches from OpenAI TTS to Gemini TTS. Single-word pronunciation always uses Gemini TTS, so it needs this key regardless of the text model. |
| `PORT` | No | API server port; `npm run dev` sets `3001`. |

The text model is chosen in the UI. See [`src/models.ts`](./src/models.ts) for
the list and the current default.

## Development commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API server and Vite together. |
| `npm run dev:api`, `npm run dev:vite` | Either half on its own. |
| `npm run build` | `tsc -b`, then the client and server bundles. |
| `npm run check` | The full pre-finish check: build, lint, and the repository's test scripts. |
| `npm run lint` | Biome. `lint:fix` writes fixes; `lint:staged` is what the commit hook runs. |
| `npm run verify:page -- <url> [--expect-text "..."]` | Drives a real browser; fails on console errors, page errors, failed requests, or missing text. |
| `npm run bricks:test`, `npm run lessons:test` | Lesson brick and lesson content checks. |
| `npm run lesson:generation:test` | Exercises the AI lesson-generation pipeline. |
| `npm run test:opening` | Generates one story opening against the real API. |
| `npm run model:compare` | Compares text models on the same prompt. |
| `npm run gemini:images`, `npm run gemini:tts`, `npm run gemini:tts:compare` | Provider comparison scripts. |

Scripts that call a provider cost money, and are deliberately not part of
`npm run check`.

## Inspecting AI calls

Every provider call the server makes can be traced to a newline-delimited JSON
log:

```bash
AI_CALL_LOG=1 npm run dev
npm run ai-log:summary  # one line per call: time, status, duration, model, kind, endpoint
npm run ai-log:pretty   # writes .artifacts/ai-calls.pretty.json for editor inspection
```

- `AI_CALL_LOG=1` (or `AI_TRACE=1`) enables the log at `logs/ai-calls.ndjson`.
- The log is **truncated when the server starts**. Set `AI_CALL_LOG_APPEND=1` to
  keep appending across restarts instead.
- Each record stores payload sizes plus a 500-character preview. Set
  `AI_CALL_LOG_PAYLOAD=full` to store complete request and response payloads —
  which means **complete prompts and learner content**. `logs/` is git-ignored;
  keep it that way.

Only real provider calls produce records. A cache hit — an already-translated
word, an already-narrated section — never reaches a provider, so it never
appears in the log. See [docs/ai-workflows.md](./docs/ai-workflows.md).

## Local data

Running the app writes saved stories, learner data, prepared queues, and
generated audio and images into the working directory. It is all git-ignored,
and all of it can be deleted — at a price. What each directory holds, what
creates it, and what you lose by removing it:
[docs/local-data.md](./docs/local-data.md).

## Project layout

| Area | Owns |
| --- | --- |
| [`src/App.tsx`](./src/App.tsx) | Top-level orchestration: which view is on screen, history and URL, model selection, background layers. |
| [`src/home_menu/`](./src/home_menu/) | The main menu: starting a typing story, starting a reading story, entering lessons, resuming and deleting saved stories. |
| [`src/story_session/`](./src/story_session/) | Story lifecycle: starting, resuming, advancing, persisting, warming the prepared queues, and coordinating narration and background images. |
| [`src/exercise_screen/`](./src/exercise_screen/) | The active learning UI and its local mechanics: typing engine, reading view and word lookups, authoring box, tutor chat, recap view, feedback form. |
| [`src/lessons/`](./src/lessons/) | Lesson definitions, the brick registry, lesson generation, and the predefined curriculum. |
| [`src/server/`](./src/server/) | The Node API: provider calls, prepared openings, saves, learner profile / preferences / story memory, caches, and AI tracing. |
| [`src/server/images/`](./src/server/images/), [`src/server/tts/`](./src/server/tts/) | Image and speech provider adapters. |
| [`src/ai.ts`](./src/ai.ts) | The browser-side client for every app-level AI operation. |
| [`src/story.ts`](./src/story.ts) | Story prompts, the reading-story schema, and its parser. |
| [`src/storyRecap.ts`](./src/storyRecap.ts) | The recap lesson's exercise specs and parser. |
| [`src/story_memory/`](./src/story_memory/) | The rolling summary that keeps long typing stories coherent. |
| [`src/genres.ts`](./src/genres.ts), [`src/models.ts`](./src/models.ts) | Genre and model definitions. |
| [`vite.config.ts`](./vite.config.ts) | React setup and the `/api` proxy for local development. |

## Further reading

- [docs/architecture.md](./docs/architecture.md) — the durable mental model and
  the two story lifecycles.
- [docs/ai-workflows.md](./docs/ai-workflows.md) — every AI operation, the layer
  that owns it, and how caching and tracing work.
- [docs/local-data.md](./docs/local-data.md) — the local directories.
- [VISION.md](./VISION.md) — what the app is trying to be.
- [curriculum.md](./curriculum.md) — the Esperanto teaching plan.
- [rosti/README.md](./rosti/README.md) — deployment.
</content>
