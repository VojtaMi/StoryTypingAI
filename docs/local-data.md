# Local data

Running the app writes files into the working directory. Nothing here is a
database — it is all plain JSON, Markdown, and media files written by the Node
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
| `learner/` | **Source data** | What the app knows about the learner: `profile.md` (the language handout), `preferences.md` (taste), `story-memory.md` (anti-repetition motifs), and `word-log.json` / `word-log-cursor.json` (words looked up, and how far they have been folded into the profile). A word-log entry looked up while reading carries an optional `storyId`; those story-scoped lookups are folded by that story's finish baseline, never by the global cursor. Menu / standalone-tutor lookups stay unscoped and continue using the cursor. |
| `word-audio/` | Generated (cache) | One pronunciation file per Esperanto word, shared across every story and lesson. |
| `lesson-audio/` | Generated (cache) — **tracked in git** | Lesson TTS output, one file per lesson and phrase. Unlike everything else here it is committed to the repository, so lessons have audio without every clone paying for it. |
| `translation-cache.json` | Generated (cache) | Word → English translation, accumulated across all stories. |
| `logs/` | Debugging artifact | `ai-calls.ndjson`, the AI trace log. Only written when `AI_CALL_LOG=1`. |
| `.artifacts/` | Debugging artifact | Scratch output: `verify:page` screenshots, `ai-log:pretty` output. Nothing reads it back. |

## The story-finish finalization record

`stories/<id>/finish-evidence.json` is the control state for folding a finished
reading story's evidence into the learner handouts. It makes finalization
idempotent: `baselineRefinedAt` guards the one-time baseline (the profile +
story-memory refine from the story summary, this story's word lookups, and the
learner's tutor questions), `feedbackRefinedAt` + `appliedFeedback` guard a late
feedback-only update tied to this same story, and `recapRefinedAt` +
`recapResultsHash` guard the recap refine. It also stores the story summary (as
context for a later feedback update) and separate aggregated story-scoped and
unscoped word lookups (audit only). It is regenerated bookkeeping — safe to delete, at the cost of possibly
re-folding a story's evidence if it is refinalized.

**Recovery is not transactional.** The baseline writes the profile, the story
memory, and this record as three separate files. A crash between them can leave a
partial state; because `baselineRefinedAt` is written *last*, recovery re-runs
(repeats) a refinement rather than skipping a half-applied one. A transactional
structured state is future work; for now a repeat is the accepted failure.

## What deleting costs

- **`learner/` — the one to be careful with.** It is the only irreplaceable
  state in the app. Deleting it resets the learner to an absolute beginner:
  future reading stories are generated against the default handout, the
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
