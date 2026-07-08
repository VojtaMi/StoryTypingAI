import type { Lesson } from "../types";

/**
 * Curriculum lessons authored with AI help via `npm run lesson:generation:append`.
 * They are ordinary predefined lessons — the script only automates writing them
 * down. Lessons the app generates for a learner at runtime never land here.
 */
export const authoredLessons: Lesson[] = [];
