# Architecture

The mental model to hold while working in this repository. For the AI operations
themselves see [ai-workflows.md](./ai-workflows.md); for what the app writes to
disk see [local-data.md](./local-data.md).

## Responsibility areas

Each area owns one concern. Code belongs to the area whose concern it serves,
not the technical layer it happens to live in.

| Area | Owns |
| --- | --- |
| [`src/App.tsx`](../src/App.tsx) | Top-level application and view orchestration: which screen is up (main menu, lessons menu, curriculum step, story overlay), browser history, the selected text model, and the crossfading background layers. |
| [`src/home_menu/`](../src/home_menu/) | Story and lesson selection, and saved-story entry: start a typing story, start a reading story, open lessons, resume or delete a save. |
| [`src/story_session/`](../src/story_session/) | The story lifecycle. Starting, resuming, advancing, and finishing a story; coordinating persistence; warming the prepared-story queues; and coordinating narration and background images. |
| [`src/exercise_screen/`](../src/exercise_screen/) | The active learning UI and its local mechanics: the typing engine and its stats, the reading view and word popovers, the authoring box, the tutor chat, the recap view, the feedback form. |
| [`src/lessons/`](../src/lessons/) | Lesson definitions and types, the exercise **bricks**, lesson generation, and the predefined curriculum. |
| [`src/server/`](../src/server/) | Provider calls, generated media, prepared openings, learner data, and the local persistence APIs. |
| [`src/server/images/`](../src/server/images/), [`src/server/tts/`](../src/server/tts/) | Provider adapters for image generation and speech. |

## Orchestration versus mechanics

The split that keeps this codebase workable:

- **Orchestration** is *what happens next, and what it costs.* Which phase the
  story is in, whether a section needs generating, when a save is written, when
  the profile is refined. It lives in `story_session` (and, for whole screens,
  in `App`). It is where money is spent and where correctness bugs are expensive.
- **Mechanics** are *how one interaction behaves.* How a keystroke scores, how a
  word popover positions itself, how a quiz item validates an answer. They live
  in `exercise_screen` and `lessons`, take their state as props, and do not know
  whether a story is finite.

`exercise_screen` therefore never generates anything or decides what comes next.
It renders the phase it is handed and reports events upward. When a change needs
new AI content, that change belongs in `story_session` or `server`, no matter
which component surfaced the need.

The same rule inside `lessons`: a brick owns one exercise type end to end — its
prompt fragment, its authoring rules, its parser, its component — and the lesson
orchestrator only composes bricks and dispatches parsing. See
[`src/lessons/bricks/README.md`](../src/lessons/bricks/README.md).

## The two story workflows

Typing stories and reading stories are both "stories", and they share a save
shape, a screen, and a session hook. **They do not share a generation
lifecycle**, and conflating them is the mistake this section exists to prevent.

| | Typing story | Reading story |
| --- | --- | --- |
| Length | Indefinite | Finite: six sections |
| Who writes the next passage | The AI, from conversation history | Nobody — it already exists |
| Learner's job | Type the passage, then author a continuation | Read the section, look up words |
| Text generation per step | One streamed continuation | **None** |
| Adapted from previous work | No | Yes — through one transient brief |
| Ends with | Nothing; you stop when you stop | A recap quiz, then a next-story brief |

### Typing-story lifecycle

```text
select genre → consume/generate opening → type passage → author continuation
→ AI continuation → repeat → persist
```

Concretely:

1. `home_menu` calls `selectGenre`.
2. `story_session` consumes a prepared opening from the queue
   (`/api/openings/:genre/consume`), and falls back to generating one if the
   queue is empty. A prepared opening carries its own title, intro, narration,
   and background image, so nothing is regenerated when one is used.
3. The opening becomes the typing target; `exercise_screen` runs the typing
   exercise and reports completion.
4. The learner authors a continuation. It is appended to the history as a `user`
   turn, and the AI's reply is **streamed** back as the next typing target.
5. Before each continuation, [`src/story_memory/`](../src/story_memory/) folds
   older turns into a rolling summary once the buffer grows past its threshold,
   so the prompt stays bounded while the story stays coherent.
6. Every phase change persists a snapshot of the whole session.
7. A background image is refreshed on a cadence driven by how much history has
   accumulated.

There is no completion state. The learner leaves; the save resumes.

### Reading-story lifecycle

```text
prepare queued reading story → consume it → reveal finite sections
→ prepare narration/backgrounds → recap → next-story brief
```

Concretely:

1. The reading queue holds at most one story, and `useReadingPreparation`
   (`src/story_session/useReadingPreparation.ts`) is its only writer. Unlike
   typing openings, nothing prepares a reading story just because the menu is
   up: finishing a story finalizes its evidence, then prepares exactly the next
	one, so the story generated always sees the self-contained brief the one
	before it just produced. The first story uses a fixed absolute-beginner brief.
	Either way, the server first asks Luna Low for a compact English plot from the
	resolved theme and explicit non-empty preferences, then runs one
	example-guided Luna editorial pass. Calibration snippets and language focus
	never enter those plot calls. The selected story model expands the resulting
	fixed plot into a **complete story** — title, story summary, characters,
	setting, and all six parts of Esperanto prose — against the pedagogical
	brief and genre guidance. It then prepares part 1's narration and image
	alongside it.
2. Starting a reading story consumes that queued story whole — **this is the
   last prose generation the story ever makes**. If the queue is empty,
   `startReadingStory` refuses to start rather than generating one on the
   spot: doing so would bypass the finalize-then-prepare ordering above.
   Instead it (re)triggers preparation and leaves the learner on the menu,
   where the button is disabled until a story is ready.
3. A story is only accepted if it parses as a complete six-part story with
   non-empty prose in every part. A truncated or short story is repaired once,
   and then rejected — a partial story is never saved as if it were complete.
4. Advancing moves a cursor: `readingPartIndex` increments and the next part is
   read out of the story already in hand. No AI call is made to reveal a section.
5. **Media coordination.** Narration and background images are the only things a
   reading story still generates, and one owner in `story_session` handles all of
   them. Every path that wants a section's media — preparing the next section
   ahead, arriving at a section whose media never landed, resuming a save,
   restarting the story — asks that owner, so a section's narration or image is
   generated at most once. Media already in hand (the queued story's part 1, the
   images from an earlier session) is seeded into the owner rather than
   regenerated, and concurrent requests for the same section join one promise
   instead of paying twice.
6. Odd-numbered sections get their own background image; even sections keep the
   previous one on screen. Because the whole story is known up front, that
   cadence is a property of the section number, not of accumulated history.
7. After the last section the session generates a recap lesson from the finished
	prose and stores it in the save. No next-story handoff exists yet.
8. When the learner completes the recap and submits feedback, or leaves the
   finished story without custom feedback, one finalization request sends the
   recap results, feedback, story-scoped word lookups, and buffered learner tutor
	questions together with all six Esperanto parts. The server distills one broad
	theme suggestion, one language focus, a progression/complexity direction, and
	one or two grounded calibration snippets. That transient brief is stored once
	per story in `finish-evidence.json`; repeated navigation is safe. See
   [ai-workflows.md](./ai-workflows.md#the-story-finish-evidence-manager).

### Why they stay separate

A reading story's value comes from being finite, complete, and adapted before
the learner sees a word of it; a typing story's comes from being unbounded and
collaborative. Every property one workflow needs — bounded token budget,
whole-story validation, prepared media, a recap — is a property the other does
not have.

**Keep their orchestration separate unless a task deliberately changes both.**
The shared pieces (the save shape, the screen, the session hook) are shared
because their *shape* coincides, not their lifecycle. Changing "how a story
continues" means picking one of them; a change that quietly generalizes over
both usually means a reading story just grew a per-section generation call, which
is the thing this design removed.

## Session, persistence, and resume

`story_session` writes a full snapshot of the session on every meaningful
transition, and the server decides where it lands: newer stories are written as a
bundle (`stories/<id>/story.json`, with `audio/` and `images/` beside it), while
older saves stay as flat files. Reads check the bundle first and fall back, so
both keep working — see [local-data.md](./local-data.md).

A reading save stores the whole story, so resuming needs no generation: the
session restores the cursor, re-seeds the media owner from the narration on its
segments and the images in its gallery, and only prepares what is genuinely
missing. Reading saves from the former frame-and-incremental-generation schema
are unsupported development data; discard them rather than adding a migration
or resurrecting a per-section generation path.

## Where a change belongs

- New screen, or a new way to move between screens → `App`.
- New way to *start* or *pick* a story → `home_menu`.
- Anything about what a story generates, when, or how it is saved →
  `story_session` (orchestration) and `server` (the call itself).
- Anything about how one exercise or interaction behaves → `exercise_screen`, or
  a `lessons` brick.
- A new provider, model, cache, or local file → `server`.
</content>
