# Teaching Brick

Live previews:

- http://localhost:5173/bricks/overview
- http://localhost:5173/bricks/possessive-table
- http://localhost:5173/bricks/color-table
- http://localhost:5173/bricks/examples

Run `npm run dev:vite` first.

## Model-authored shape

The teaching brick is model-authored for `overview`. The other teaching aliases
are hand-authored lesson sections that share the renderer.

```json
{
  "title": "Teaching point title",
  "body": [
    "Plain-English explanation paragraph",
    "Optional second paragraph"
  ]
}
```

Use one or two short English paragraphs. Keep this to the lesson theme, context,
or communication goal; standalone grammar mechanics belong in the grammar brick.
