# AI workflows

The browser never talks directly to a provider:

```text
feature → src/ai.ts → /api → src/server → provider
```

Language-sensitive calls carry a validated `GenreId`; the server resolves
generation, tutor, recap, image, and pronunciation guidance from
`src/genres.ts`.

| Operation | Owner |
| --- | --- |
| Complete story planning, manuscript, semantic split, visual plan | `src/server/openingsStore.ts`, `src/reading_story/`, `src/story.ts` |
| Section narration and images | `src/story_session/readingMedia.ts`, `src/server/storyAudioStore.ts`, `src/server/images/` |
| Contextual word glosses and pronunciation | `src/server/aiEndpointHandlers.ts`, `src/server/wordAudioStore.ts` |
| Story recap | `src/storyRecap.ts` and `src/story_session/` |
| Next-story brief and anti-repetition record | `src/server/nextStoryBriefService.ts`, `src/server/storyFinalizationService.ts` |
| Tutor chat | `src/exercise_screen/chatbot/LanguageChatModal.tsx` and `src/ai.ts` |

The whole manuscript is generated before reading begins. Advancing sections
never generates prose. On finish, one idempotent record at
`stories/<language>/<id>/finish-evidence.json` binds the evidence and successor brief;
reopening an old story cannot revise that handoff.

Translation/audio files and in-flight media work are cached. Cache hits do not
call a provider. Enable `AI_CALL_LOG=1` to trace real provider calls to
`logs/ai-calls.ndjson`; `AI_CALL_LOG_PAYLOAD=full` includes full prompts and
learner content and should be handled as private data.
