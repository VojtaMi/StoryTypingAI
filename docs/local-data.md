# Local data

Runtime data is plain, git-ignored JSON and media. This generalized worktree
starts with no user data.

| Path | Contents and language scope |
| --- | --- |
| `stories/<language>/<id>/` | Saved story, section media, and finish evidence. Story ids also begin with the language, so API lookups resolve directly to the correct folder. |
| `saves/` | Legacy flat saved-story location, read as a fallback. |
| `reading-openings/<genreId>.json` | One prepared complete story per language. |
| `word-audio/<genreId>/` | Language-specific pronunciation cache. |
| `story-images/`, `story-audio/` | Legacy media location for older ids. |
| `learner/state.json` | Shared explicit `prefer` and `avoid` settings plus language-tagged anti-repetition memory. |
| `learner/word-log.json` | Story-scoped word evidence; story ids bind it to one language's progression chain. |
| `logs/`, `.artifacts/` | Optional traces and development output. |

The browser stores only `last-learning-language` for the default home selection.
The active tab's URL remains authoritative, allowing different languages in
different tabs.

Deleting caches is safe but can cause paid regeneration. Deleting `stories/`,
`saves/`, or `learner/` loses user-created history or settings. AI trace logs can
contain complete learner content when full payload logging is enabled and must
remain untracked.
