---
name: api-testing
description: Test prompt and model behavior against local OpenAI, Anthropic, and Gemini API keys in this repo. Use when comparing outputs, validating prompt changes, running model benchmarks, or checking provider-specific API behavior.
---

# API Testing

Use this skill when the user wants to compare model outputs, debug provider-specific API behavior, or run prompt experiments in this repository.

## Workflow

1. Load local secrets before any shell command that needs them.
   - Prefer the repo scripts that already load `.env.local`.
   - For one-off commands, source it first:
     ```bash
     set -a
     source .env.local
     set +a
     ```

2. Pick the right provider.
   - OpenAI models use `OPENAI_API_KEY`.
   - Anthropic models use `ANTHROPIC_API_KEY`.
   - Gemini models use `GEMINI_API_KEY`.
   - Prefer `gpt-5.4-mini` for quick iterations unless the user asks for a stronger comparison.

3. Use the repo's existing test scripts before inventing new ones.
   - `npm run test:opening` for story-opening checks.
   - `npm run model:compare` for broader story comparison runs.
   - `npm run gemini:images`, `npm run gemini:tts`, and `npm run gemini:tts:compare` for Gemini-specific media tests.

4. Compare results for quality, not just validity.
   - Check whether the output is more natural, more consistent, and better aligned with the prompt.
   - If reviewing story text, prefer edits that preserve meaning while improving Esperanto flow, concrete detail, and continuity.
   - If comparing providers, note which model produced the best tradeoff between quality, latency, and cost.

## Safety And Habits

- Never print API keys or paste secrets into outputs.
- Treat `.env.local` as local-only workspace state.
- If a command fails because a key is missing, confirm which provider the user wants and which environment file should be loaded before retrying.
