# Lesson Bricks

A brick is a self-contained lesson unit: typed `example`, renderer, bot-context projection, and optional generation contract. Body bricks use `LessonBodyBrickSpec<T>`; exercise bricks use `ExerciseBrickSpec<T>`.

There are two tiers. Body bricks are authored by the model through `shape`, `instructions`, and `parse`. Exercise bricks are derived from parsed body content through `create()`. The model never authors an exercise.

Use this rule to choose the tier: must this agree with something else in the lesson? If yes, derive it in code. The typing exercise is the story; the word-match cards are the `introducedWords`. This follows `CLAUDE.md`'s rule to shrink what we ask the LLM for and derive invariants deterministically.

`phrase-builder` is the worked exception. Its `prompts` carry real lesson content that is not derivable from existing body blocks, so it is not generatable and only appears in hand-written lessons. Making it generatable would mean moving it to the authored tier, and its `answer: string[]` must then be derived by splitting a model-authored sentence, never asked for pre-split.

`requires` keeps derived exercises coherent. An exercise brick names the body brick it depends on, and `getLessonBricks()` rejects an incoherent selection before any API call.

Registry keys alias to specs. There are 8 body registry keys but only 5 body bricks: `overview`, `possessive-table`, `color-table`, and `examples` all use the `teaching` brick. The aliasing belongs in `registry.ts`.

To add a brick, add its folder under `src/lessons/bricks/` with an `index.ts` spec, component file, and CSS file if it owns non-trivial styles. Export it through `registry.ts` and `index.ts`. `npm run bricks:test` requires every registry entry to have an `example`.

To inspect bricks visually, run `npm run dev:vite` and open `/bricks.html`.
