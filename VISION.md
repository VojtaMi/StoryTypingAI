# Story-Based Language Learning Vision

This project is evolving from an AI typing-practice story app into a
story-based language learning app. The core loop is already in place: short
Esperanto reading stories, typing practice, narration, images, local saves,
word translation/audio popovers, and the Esperanto Bot tutor.

The product direction is guided story practice, not a generic flashcard deck. A
learner should see and hear language in context, ask questions when confused,
practice what they saw, and then get future stories that reuse what is becoming
familiar while gently stretching one step further.

Esperanto is the first prototype language because its regular grammar and
predictable word forms make the learning loop easier to prove before adding
languages with heavier early grammar.

## Current Learning Model

The app now has a lightweight learner model for adaptive reading:

- `learner/profile.md` stores a bounded, human-readable learner handout.
- The seed profile treats the learner as a complete beginner, preserving the
  original day-one behavior.
- When the Esperanto Bot chat closes, the transcript is folded into the profile
  as evidence about confident, current-edge, and shaky vocabulary/grammar.
- Reading story generation receives the profile as a ceiling and target: reuse
  known material, stretch into currently-learning material, and avoid exceeding
  the learner's edge.
- Clicking a word in the reader logs `{ "word", "timestamp" }` to
  `learner/word-log.json` as raw evidence that the word needed inspection.

This is deliberately smaller than a full curriculum engine. The profile is the
LLM-facing summary; the word log is raw evidence. Both are local single-user
files.

## Near-Term Shape

The prose profile should stay concise and derived. It should not become an
unbounded diary or a substitute for structured state. It answers one immediate
question: "What should the next reading story assume this learner knows?"

The word log should remain append-only for now. Repeated clicks can later be
aggregated into the profile, for example "recently looked up several times:
`havas`, `iras`, `mia`." A single click is weak evidence; repeated clicks across
stories are stronger.

The next useful refinement is a small scoring layer on top of the log:

- clicked word: possible recognition gap
- correctly typed or answered later: increase familiarity
- repeated correct use: mark familiar enough to stop surfacing as shaky
- repeated lookup or mistake: keep in review

That scoring layer can be added without changing the current profile format.

## Future Curriculum Model

If the app needs more precise control, add structured state beneath the prose
profile rather than replacing the profile immediately:

- Word/concept registry: lemma, translation, examples, status, score.
- Evidence log: clicked words, chat questions, typing mistakes, correct answers.
- Review scheduling: weak, known, review due, retired/familiar.
- Lesson content: introduced words, target sentences, story text, exercises.

The prose profile can then be regenerated from the structured evidence and used
only as compact context for story generation.

## Exercise Direction

Early lessons and reading stories should rotate through a few exercise types:

- Type-over practice using the existing typing exercise.
- Multiple-choice comprehension questions.
- Fill-the-missing-word exercises.
- Reading popovers for translation and word audio.
- Later, AI-generated variants constrained to known vocabulary and unlocked
  grammar.

Exercise selection can be flexible, but it should respect the learner model:
known words should dominate, weak words should reappear, and new material should
arrive slowly.

Today exercises live in dedicated sessions (typing story, reading story)
rather than inside a story itself. A further step under consideration is
letting exercises appear dynamically within a story's parts, and closing each
story with a recap exercise — see Story Completion Moment below.

## Story Completion Moment (idea, undecided)

Today, finishing a story shows an inline feedback card asking about difficulty.
One direction being considered: replace this with a light-themed modal —
"Congratulations for completing the story," the Esperanto Bot companion, and a
gallery of the images generated across the story's parts as a visual recap.
Difficulty feedback would still be captured here, alongside the celebration.

This moment could also be where a recap exercise lives — a short exercise
drawing on the vocabulary/sentences from the story just read, once exercises
can be generated dynamically per-story rather than only in dedicated typing
sessions (see Exercise Direction below). Open questions: whether the recap
exercise blocks moving on, how it relates to the mid-story exercise rotation,
and whether the modal replaces or supplements the existing feedback card.

## AI Boundary

AI should remain a constrained content generator, not the curriculum itself.

The current adaptive-reading loop is acceptable because it is bounded: a small
profile, local files, explicit prompt guardrails, and beginner-oriented story
constraints. Future structured scoring should make the system more reliable,
not more magical.

Generated beginner content should keep being validated by shape and constrained
by vocabulary/grammar guidance before it reaches the learner.
