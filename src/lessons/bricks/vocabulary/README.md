# Vocabulary Brick

Live preview: http://localhost:5173/bricks/vocabulary

Run `npm run dev:vite` first.

## Model-authored shape

```json
{
  "words": [
    {
      "term": "Esperanto word",
      "meaning": "English meaning",
      "partOfSpeech": "noun | verb | adjective | adverb | pronoun | phrase",
      "example": "Short Esperanto example using the word"
    }
  ]
}
```

Generate three to six words. Each example must be a simple complete Esperanto
sentence containing the term plus at least one other word, because `fill-blank`
derives its prompt from that sentence. Each English meaning must be distinct.
