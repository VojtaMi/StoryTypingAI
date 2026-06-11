export type GenreId = 'fantasy' | 'scifi' | 'horror'

export interface Genre {
  id: GenreId
  label: string
  emoji: string
  /** Accent color used to tint the menu circle. */
  color: string
  /** System prompt that sets the tone for this genre's story. */
  systemPrompt: string
}

const sharedStyleGuide =
  'You are a collaborative storyteller co-writing an interactive story with the user. ' +
  'Write vivid, immersive prose in short segments of 2 to 4 sentences. ' +
  'The user adds their own continuations; build on them naturally and keep the story coherent. ' +
  'Output only the story prose — no titles, headings, meta-commentary, or instructions to the user.'

export const genres: Genre[] = [
  {
    id: 'fantasy',
    label: 'Fantasy',
    emoji: '🐉',
    color: '#bb9af7',
    systemPrompt: `${sharedStyleGuide} The genre is high fantasy: magic, mythical creatures, ancient kingdoms, and epic quests.`,
  },
  {
    id: 'scifi',
    label: 'Sci-Fi',
    emoji: '🚀',
    color: '#7aa2f7',
    systemPrompt: `${sharedStyleGuide} The genre is science fiction: distant futures, starships, advanced technology, and the unknown reaches of space.`,
  },
  {
    id: 'horror',
    label: 'Horror',
    emoji: '👻',
    color: '#f7768e',
    systemPrompt: `${sharedStyleGuide} The genre is horror: dread, the uncanny, creeping tension, and things that should not be. Keep it unsettling but not gratuitously graphic.`,
  },
]
