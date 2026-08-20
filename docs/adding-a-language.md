# Adding a language

This is the coding-agent workflow for adding a curated learning language. A
language is a product and pedagogy change, not a translation-only change. Keep
the interface in English and do not add deployment changes unless explicitly
requested.

## Inputs to establish

Before editing, establish:

- a lowercase ASCII language ID, such as `dutch`;
- its English display label and a 2–4 letter uppercase short code;
- beginner grammar priorities and constructions to avoid;
- a natural target-language recap title and answer example;
- at least one absolute-beginner calibration passage;
- a wide story-poster image, a square transparent-background bot image, and a
  legible SVG favicon.

If these pedagogical choices cannot be made responsibly, stop and ask for
direction. Do not copy another language's grammar guidance and merely replace
its name.

## Implementation

1. Add one complete entry to `src/genres.ts`. The registry is the source of
   truth for IDs, UI selection, prompts, TTS, storage validation, CLI options,
   titles, bot identity, and favicon selection.
2. Put the poster and bot under `public/images/` and the favicon under `public/`.
   Existing assets use 1672×941 for posters and 1254×1254 for bots. Match the
   established visual family and use distinct paths; do not reuse another
   language's assets.
3. Add focused assertions to `tests/languages.test.ts` for rules that are
   important or unusual in the new language. Generic registry and asset
   invariants are already checked automatically.
4. Update the language list and example query in `README.md`.
5. Search for language-specific exceptions with
   `rg -n 'esperanto|german|spanish' src scripts tests README.md docs`. Most
   matches are examples or intentional language-specific behavior. Change only
   code that should apply to every registered language.

Do not add special vocabulary normalization unless the language requires it.
For example, Esperanto's accusative-name handling in `src/storyVocabulary.ts`
is deliberately Esperanto-only.

## Verification

Run the deterministic checks first:

```bash
npm run language:validate -- dutch
npm run check
```

The validator checks registry completeness, uniqueness, asset paths, and story
ID/storage compatibility. It does not judge language quality.

When provider credentials are available and spending a small amount is
acceptable, generate one smoke-test story:

```bash
npm run story:generate -- --language dutch --default-learner
```

Read the result rather than treating successful JSON generation as sufficient.
Check that prose is actually in the target language, character names are
natural for it, the level resembles the calibration passage, required grammar
is correct, metadata remains English, and the recap example is idiomatic.

Finally, render the main menu and verify the language selector, dynamic browser
title, favicon, poster, and bot. Do not deploy or generate production caches as
part of this workflow.
