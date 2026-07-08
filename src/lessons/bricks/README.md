# Lesson Bricks

A brick is a self-contained lesson unit: typed `example`, renderer, bot-context projection, and optional generation contract. Body bricks use `LessonBodyBrickSpec<T>`; exercise bricks use `ExerciseBrickSpec<T>`.

There are two tiers. Body bricks are authored by the model through `shape`, `instructions`, and `parse`. Exercise bricks are derived from parsed body content through `create()`. The model never authors an exercise.

Use this rule to choose the tier: must this agree with something else in the lesson? If yes, derive it in code. The typing exercise is the story; the word-match cards are the `introducedWords`; the fill-blank prompts are each word's `example` with its `term` carved out by `clozeFor`. This follows `CLAUDE.md`'s rule to shrink what we ask the LLM for and derive invariants deterministically.

`phrase-builder` is the worked exception. Its `prompts` carry real lesson content that is not derivable from existing body blocks, so it is not generatable and only appears in hand-written lessons. Making it generatable would mean moving it to the authored tier, and its `answer: string[]` must then be derived by splitting a model-authored sentence, never asked for pre-split. `patterns` and `resources` are non-generatable for the same reason: nothing in a lesson implies them.

## The doc composes; it does not choose

`lessonBodyBlocks()` returns a lesson's hand-authored `teachingSections` **followed by** the blocks synthesized from its canonical fields (vocabulary, grammar, patterns, story, resources). It used to return the teaching sections *instead of* the synthesized ones. That silently deleted `nia-gardeno`'s grammar and patterns from both the page and the tutor bot, made an `overview` section impossible to add to any lesson without destroying its body, and meant a generated lesson that selected the `overview` brick rendered nothing but the overview. If a lesson must suppress a synthesized block, change what it authors — not how the doc composes.

`buildLessonBotContext` projects every block through `describeLessonBodyBlock` for the same reason. It used to hand-roll vocabulary and story and filter those types out of the loop, which made `vocabularyBrick.toBotContext` and `storyBrick.toBotContext` unreachable code.

## Preconditions

`requires` keeps derived exercises coherent. An exercise brick names the body brick it depends on, and `getLessonBricks()` rejects an incoherent selection before any API call.

`assertRenderable` keeps a *lesson* coherent. A derived exercise can be listed by a lesson that lacks what it renders — a `wordTerms` typo, an empty story, two words sharing an English gloss. It runs where a lesson is born (`parseGeneratedLesson`, and `npm run lessons:test` over the hand-written corpus), never at render, where the empty screen is already up.

`clozeFor` states the property both the vocabulary card and `fill-blank` depend on: an `IntroducedWord.example` contains its `term` as a whole token, plus at least one other word. The vocabulary brick owns it because it owns that field's shape.

## Layout

Registry keys alias to specs. There are 9 body registry keys but only 6 body bricks: `overview`, `possessive-table`, `color-table`, and `examples` all use the `teaching` brick. The aliasing belongs in `registry.ts`.

Block types live in `src/lessons/types.ts`, not in the brick folders — `registry.ts` reaches React components, the chat modal, and CSS side-effects, and `types.ts` is imported by every script. `LessonExercise` is the same arrangement.

To add a brick, add its folder under `src/lessons/bricks/` with an `index.ts` spec and a component file; style it from `lesson.css` (no brick owns a stylesheet, and none should reach into `index.css`). Export it through `registry.ts` and `index.ts`. `npm run bricks:test` requires every registry entry to have an `example`; `npm run lessons:test` requires our lessons to satisfy every brick's preconditions.

To inspect bricks visually, run `npm run dev:vite` and open
[`/bricks`](http://localhost:5173/bricks). Individual bricks are available at
`/bricks/<registry-key>`, for example
[`/bricks/fill-blank`](http://localhost:5173/bricks/fill-blank).
