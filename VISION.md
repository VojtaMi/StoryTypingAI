# Story-Based Language Learning Vision

This project is evolving from an AI typing-practice story app into a story-based
language learning app. The current app already has useful foundations: story
segments, typing exercises, audio narration, image generation, local saves, and
AI-backed story continuation. The next step is to give those pieces a curriculum
center.

The first prototype language should be Esperanto. Its regular grammar and
predictable word forms make it a good place to prove the learning loop before
adding languages with heavier early grammar, such as German.

## Product Direction

The app should teach through short, simple stories. A learner starts with a tiny
set of words, sees and hears them in context, practices them through varied
exercises, and gradually unlocks new vocabulary and grammar concepts.

The experience should feel like guided story practice, not a generic flashcard
deck. Each lesson introduces just enough language to support a small meaningful
sentence or story. The learner's vocabulary state should be tracked over time so
the app can reuse known words, reinforce weak words, and introduce new words at
a controlled pace.

AI should eventually make the stories more adaptive, but the first version
should use premade lesson content. Hand-authored content lets the project prove
the core learning loop before relying on generated language for beginners.

## First Esperanto Lesson Shape

A complete beginner lesson can begin with a very small vocabulary set:

- `estas` - is / are
- `hundo` - dog
- `besto` - animal

After introducing those words, the app can form the first sentence:

```text
Hundo estas besto.
```

Then it can introduce:

- `mi` - I
- `homo` - person / human

And form:

```text
Mi estas homo.
```

Next, it can introduce a first grammar concept: possession with `mia`.

```text
mia hundo
```

The lesson can then connect the known words into a tiny story:

```text
Mi estas Adamo. Mi estas homo. Mia hundo estas bruna.
```

This is intentionally small. The goal is not to impress with story complexity at
the start; the goal is to make the learner understand every word in a simple
story and feel progress quickly.

## Exercise Mix

Early lessons should rotate through a few exercise types:

- Type-over practice, using the existing typing exercise for target sentences.
- Multiple-choice comprehension questions about the story.
- Fill-the-missing-word exercises with answer options.
- Later, AI-generated variants constrained to the learner's known vocabulary and
  unlocked grammar concepts.

Exercise selection can be random within lesson constraints, but it should still
respect what the learner has already seen. New words should be introduced
deliberately, weak words should reappear more often, and known words should make
up most of each story.

## Curriculum Model

Future implementation should add curriculum-owned data before reshaping the
whole interface. The main concepts are:

- Learner vocabulary state: `new`, `weak`, `known`, and `review due`.
- Grammar concept state: `locked`, `introduced`, `practicing`, and `mastered`.
- Lesson content: introduced words, target sentences, story text, and exercises.
- Exercise model: typing, multiple choice, and cloze/fill-word exercises.

The current story session model can remain useful, but learning progress should
become its own domain rather than being hidden inside story text alone.

## AI Boundary

AI should be introduced in stages:

1. V1 uses hand-authored Esperanto lessons and exercises.
2. V2 asks AI to generate short story variants only from allowed vocabulary and
   unlocked grammar concepts.
3. Later versions adapt story content and review timing from learner history.

Generated content should be validated before it reaches a beginner learner. The
AI should be treated as a constrained content generator inside the curriculum,
not as the curriculum itself.
