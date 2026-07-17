# Local data

Running the app writes files into the working directory. Nothing here is a
database — it is all plain JSON and media files written by the Node
server ([`src/server/`](../src/server/)) and created lazily on first use.

Everything below is **git-ignored**, with one exception noted in the table.
Deleting any of it is safe in the sense that the app will recreate what it needs
— but regenerating means paying a provider again, and two of these directories
hold things that cannot be regenerated at all.

## The directories

| Path | Kind | What it holds |
| --- | --- | --- |
| `stories/` | Generated | The current home for a saved story: `stories/<id>/story.json`, with `audio/` and `images/` beside it, plus `finish-evidence.json` (the story-finish finalization record — see below). A reading save contains the whole six-part story, so it can be re-read without any generation. |
| `saves/` | Generated | Older flat saves, `saves/<id>.json`. Reads check `stories/` first and fall back here, so both formats keep working; new stories with a bundle id are written to `stories/`. |
| `story-images/` | Generated | Still used — the background images for stories whose id predates the bundle layout. Newer stories keep their images in `stories/<id>/images/`. |
| `story-audio/` | Generated | The same, for narration: older stories' section audio. Newer stories use `stories/<id>/audio/`. |
| `openings/` | Generated (cache) | The prepared **typing** opening queue: one JSON per genre, holding the opening text, title, intro, narration, and background image. Consumed (deleted) when a typing story starts, and refilled in the background. |
| `reading-openings/` | Generated (cache) | The prepared **reading** queue: one JSON per genre, holding a *complete* six-part story plus part 1's narration and image. Consumed when a reading story starts, and refilled in the background. |
| `learner/` | **Source data** | What the app knows about the learner: one validated, bounded `state.json` containing the language profile, story preferences/clarity guidance, and anti-repetition memory, plus `word-log.json` / `word-log-cursor.json`. A word-log entry looked up while reading carries an optional `storyId`; those story-scoped lookups are folded by that story's finish baseline, never by the global cursor. Menu / standalone-tutor lookups stay unscoped and continue using the cursor. |
| `word-audio/` | Generated (cache) | One pronunciation file per Esperanto word, shared across every story and lesson. |
| `lesson-audio/` | Generated (cache) — **tracked in git** | Lesson TTS output, one file per lesson and phrase. Unlike everything else here it is committed to the repository, so lessons have audio without every clone paying for it. |
| `translation-cache.json` | Generated (cache) | Word → English translation, accumulated across all stories. |
| `logs/` | Debugging artifact | `ai-calls.ndjson`, the AI trace log. Only written when `AI_CALL_LOG=1`. |
| `.artifacts/` | Debugging artifact | Scratch output: `verify:page` screenshots, `ai-log:pretty` output. Nothing reads it back. |

The former `profile.md`, `preferences.md`, and `story-memory.md` development
files are no longer read. There is intentionally no runtime compatibility layer;
preserve them only as a manual reference until their useful content has been
represented in `state.json`.

## Learner-state ownership

`learner/state.json` is one shared learner state, not separate instruction files.
The Settings panel edits the learner's durable story preferences — `prefer`
and `avoid` — in that same object. Story finalization may rewrite the
complete state after a story finishes, so those edits remain part of the same
profile used for future generation. The app manages language-learning evidence
and story-memory fields; `clarityGuidance` is also AI-managed from story feedback.
All learner-state mutations are serialized through the shared mutation queue.

## The story-finish finalization record

`stories/<id>/finish-evidence.json` is the control state for folding a finished
reading story's evidence into the learner state. It makes finalization
idempotent: `finalizedAt` guards the one-time finalization of the story summary,
recap results, feedback, learner questions, and word lookups. It also stores the
story summary, feedback, recap results, and separate aggregated story-scoped and
unscoped word lookups (audit only). If a late question or feedback arrives, only
the new delta is applied. It is regenerated bookkeeping — safe to delete, at the
cost of possibly re-folding a story's evidence if it is refinalized.

The profile, preferences, and story memory are written together by atomically
replacing `learner/state.json`, so they cannot diverge through partial writes.
That replacement and `finish-evidence.json` are still separate writes. Because
`finalizedAt` is written last, a crash between them re-runs the refinement
rather than skipping an unapplied update; a repeat remains the accepted failure.

## What deleting costs

- **`learner/` — the one to be careful with.** It is the only irreplaceable
  state in the app. Deleting it resets the learner to an absolute beginner:
  future reading stories are generated against the default state, the
  preferences that steered them away from disliked motifs are gone, and the
  anti-repetition memory starts over. It cannot be rebuilt from the stories on
  disk. Back it up before you clear the working directory.
- **`stories/` and `saves/` (and `story-images/`, `story-audio/`).** Deleting
  loses the stories themselves — prose, narration, images, recap progress.
  Nothing regenerates them; they are gone. Deleting a story through the app
  removes all four locations for that id at once.
- **`openings/` and `reading-openings/`.** Safe. They are a queue, not history:
  the next visit to the menu refills them in the background. The only cost is
  that the next story you start may have to generate on the spot instead of
  appearing instantly — and a discarded queued reading story is a whole story's
  worth of tokens thrown away.
- **`word-audio/`, `lesson-audio/`, `translation-cache.json`.** Safe. Each entry
  is regenerated on the next request for that word or phrase. The cost is a
  provider call per entry, spread over time. (`lesson-audio/` is checked in, so
  deleting it also shows up as a git change — restore it rather than
  regenerating it.)
- **`logs/` and `.artifacts/`.** Always safe. Nothing in the app reads them.

## Privacy

The AI trace log can contain learner content. With `AI_CALL_LOG_PAYLOAD=full`,
every record holds the complete request and response: whole prompts, whole
stories, the learner profile, and tutor-chat messages verbatim. `learner/` and
`logs/` are both git-ignored, and should stay that way. Do not paste raw trace
records or profile contents into issues, commits, or documentation.
</content>
