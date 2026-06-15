# Story Typing

An interactive AI typing-practice app. Pick a genre, and an AI writes a story
one segment at a time. You **type** each AI segment as a typing exercise, then
**author** your own continuation — which the AI builds on. It's a collaborative
story and a typing drill at once.

## How it works

1. On the menu, choose a genre — 🐉 Fantasy, 🚀 Sci-Fi, or 👻 Horror.
2. The AI writes the opening of the story.
3. Type the opening as a typing exercise — live WPM, accuracy, time, and
   mistakes update as you go.
4. When you finish, write your own continuation in your own words.
5. The AI reads your continuation and writes the next segment, which becomes
   your next typing target.
6. Repeat for as long as you like. Stories save as local JSON files, so you can
   return to the menu and resume them later.

## Features

- **AI-generated stories** — each genre has its own tone; the conversation
  history is kept, so the story stays coherent across turns.
- **Live stats** — WPM, accuracy, elapsed time, and mistake count update while
  you type (the clock ticks on a timer, not just on keystrokes).
- **Per-character feedback** — each character is colored correct / incorrect /
  pending, with a blinking caret on the current position.
- **Progress bar** — shows how far through the current segment you are.
- **Free authoring** — your continuations are written freely (typing practice
  happens on the AI's text; the creative input is yours).
- **Local file saves** — while running the Vite dev server, saved stories are
  written to `saves/*.json` and shown on the menu for resume/delete.
- Hidden input keeps focus on the passage; click the passage to refocus.

## Tech

React 19 + TypeScript + Vite, with the [`openai`](https://www.npmjs.com/package/openai)
SDK for story generation (model `gpt-5.4-mini`, configurable in `vite.config.ts`).
The dev server exposes local `/api/saves` endpoints for JSON file saves and a
`/api/ai/complete` endpoint that proxies OpenAI calls server-side.

## Getting started

This app calls the OpenAI API, so it needs an API key.

```bash
npm install

# Add your OpenAI key — kept server-side, never sent to the browser:
echo 'OPENAI_API_KEY=sk-...' > .env.local

npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
```

Saved stories are local development files under `saves/`, which is git-ignored.
The file-save and AI proxy APIs are provided by Vite during `npm run dev`; a
static production build does not include that local filesystem backend.

`.env.local` is git-ignored (via `*.local`); never commit your key.

## Project layout

- `src/App.tsx` — orchestrator: the `menu → story` state machine and AI loop.
- `src/Menu.tsx` — the genre-selection circles.
- `src/StoryView.tsx` — the story log, active typing target, and authoring box.
- `src/TypingExercise.tsx` — the reusable typing engine (stats, caret, progress).
- `src/ai.ts` — `startStory` / `continueStory` / `titleStory` calls via the dev server proxy.
- `src/genres.ts` — genre definitions and their system prompts.
- `src/index.css` — theme and layout.
- `vite.config.ts` — Vite plugins: `savesApi` (local file saves) and `aiApi` (OpenAI proxy).
- `aichat_reference/` — the original Node CLI chat reference the AI loop is based on.
