---
name: esperanto-lesson-generation
description: Author an Esperanto curriculum lesson from curriculum context and app-provided lesson brick requirements, then commit it to the repository's predefined lessons.
---

# Esperanto Lesson Generation

Use this skill to author a new **predefined curriculum lesson** and store it in the repository.

This is not the app's runtime lesson generation. Lessons the app generates for a learner on request are ephemeral and belong to that learner; they never pass through this skill.

The app owns brick discovery, prompt assembly, parsing, validation, rendering, routing, and storage. The AI's job is only to return the lesson **body** JSON that satisfies the brick requirements and curriculum context. Exercises are derived from the body by the app — never author them.

## Workflow

1. Run `npm run lesson:generation:bricks -- --goal "..."` to print the `selection` (level and bricks in play), your `goal`, the `curriculum.md` context, and the composed `prompt`. The prompt contains the exact JSON shape and the per-brick authoring instructions.
2. Return only the JSON that defines the lesson: `title`, `lede`, and one `body` entry per body brick, in order. Do not emit an `exercises` key. Do not add prose, markdown fences, comments, or extra fields.
3. Run `npm run lesson:generation:append -- --input path/to/lesson.json` to validate and store it in `src/lessons/predefined/authoredLessons.ts`. The script owns parsing, derived exercises, IDs, duplicate detection, and formatting.

The lesson ID is a slug of the title, so re-running step 3 on the same lesson is rejected as a duplicate. If two distinct lessons legitimately share a title, pass `--id <slug>`.

## Validation

When changing the lesson generation program or predefined lesson data in this repository, run:

```bash
npm run lesson:generation:test
npm run check
```

For skill text or lint-only edits, `npm run lint` is acceptable. Normal code or curriculum changes should use `npm run check`.
