import type { ReactNode } from "react";
import {
	type GenerationSpec,
	isObject,
	requiredString,
	slugify,
} from "../../structuredGeneration";
import { lessonStoryText, lessonVocab } from "../lessonContent";
import type {
	GrammarConcept,
	IntroducedWord,
	Lesson,
	LessonPattern,
	LessonTeachingSection,
} from "../types";
import {
	describeTeachingSection,
	renderTeachingSection,
	renderWithCode,
} from "./teachingBricks";

interface LessonVocabularyBlock {
	id: string;
	type: "vocabulary";
	title: string;
	words: IntroducedWord[];
}

interface LessonGrammarBlock {
	id: string;
	type: "grammar";
	title: string;
	concepts: GrammarConcept[];
}

interface LessonPatternsBlock {
	id: string;
	type: "patterns";
	title: string;
	patterns: LessonPattern[];
}

interface LessonStoryBlock {
	id: string;
	type: "story";
	title: string;
	intro: string;
	text: string;
	sentences?: string[];
}

export type LessonBodyBlock =
	| LessonTeachingSection
	| LessonVocabularyBlock
	| LessonGrammarBlock
	| LessonPatternsBlock
	| LessonStoryBlock;

export interface LessonBodyRenderCtx {
	ready: Set<string>;
	playing: string | null;
	onPlay: (id: string, text: string) => void;
}

export interface LessonBodyBrickSpec<T extends LessonBodyBlock> {
	example: T;
	render(block: T, ctx: LessonBodyRenderCtx): ReactNode;
	toBotContext(block: T): string;
	generation?: GenerationSpec<LessonBodyBlock>;
}

function SpeakButton({
	id,
	text,
	ready,
	playing,
	onPlay,
}: {
	id: string;
	text: string;
	ready: boolean;
	playing: string | null;
	onPlay: (id: string, text: string) => void;
}) {
	const isPlaying = playing === id;
	return (
		<button
			type="button"
			className={`lesson-speak${isPlaying ? " lesson-speak--active" : ""}${!ready ? " lesson-speak--loading" : ""}`}
			aria-label={isPlaying ? "Playing..." : `Listen to "${text}"`}
			onClick={() => onPlay(id, text)}
			disabled={!ready || (playing !== null && !isPlaying)}
		>
			🔊
		</button>
	);
}

export function lessonBodyBlocks(lesson: Lesson): LessonBodyBlock[] {
	if ((lesson.teachingSections?.length ?? 0) > 0) {
		return lesson.teachingSections ?? [];
	}

	const blocks: LessonBodyBlock[] = [];
	const vocab = lessonVocab(lesson);
	const storyText = lessonStoryText(lesson);

	if (vocab.length > 0) {
		blocks.push({
			id: `${lesson.id}.vocabulary`,
			type: "vocabulary",
			title: "New words",
			words: vocab,
		});
	}

	if (lesson.grammarConcepts.length > 0) {
		blocks.push({
			id: `${lesson.id}.grammar`,
			type: "grammar",
			title: "Grammar",
			concepts: lesson.grammarConcepts,
		});
	}

	if ((lesson.patterns?.length ?? 0) > 0) {
		blocks.push({
			id: `${lesson.id}.patterns`,
			type: "patterns",
			title: "Patterns",
			patterns: lesson.patterns ?? [],
		});
	}

	if (storyText) {
		blocks.push({
			id: `${lesson.id}.story`,
			type: "story",
			title: "Your story",
			intro: "Read it aloud, then type it from memory on the next screen.",
			text: storyText,
		});
	}

	return blocks;
}

const vocabularyBrick: LessonBodyBrickSpec<LessonVocabularyBlock> = {
	example: {
		id: "vocabulary",
		type: "vocabulary",
		title: "New words",
		words: [
			{
				term: "kato",
				meaning: "cat",
				partOfSpeech: "noun",
				example: "La kato estas en la domo.",
			},
			{
				term: "domo",
				meaning: "house",
				partOfSpeech: "noun",
				example: "La domo estas granda.",
			},
			{
				term: "en",
				meaning: "in",
				partOfSpeech: "preposition",
				example: "La kato estas en la domo.",
			},
		],
	},
	generation: {
		shape: {
			words: [
				{
					term: "Esperanto word",
					meaning: "English meaning",
					partOfSpeech: "noun | verb | adjective | adverb | pronoun | phrase",
					example: "Short Esperanto example using the word",
				},
			],
		},
		instructions:
			"Introduce three to six canonical vocabulary items for the lesson. " +
			"Use target words when provided. Each example must be simple Esperanto that a learner at this level can understand.",
		example: {
			words: [
				{
					term: "kato",
					meaning: "cat",
					partOfSpeech: "noun",
					example: "La kato estas en la domo.",
				},
				{
					term: "domo",
					meaning: "house",
					partOfSpeech: "noun",
					example: "La domo estas granda.",
				},
				{
					term: "en",
					meaning: "in",
					partOfSpeech: "preposition",
					example: "La kato estas en la domo.",
				},
			],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.words) ||
				value.words.length < 3 ||
				value.words.length > 6
			) {
				throw new Error("Generated vocabulary needs three to six words.");
			}
			return {
				id: "vocabulary",
				type: "vocabulary",
				title: "New words",
				words: value.words.map((word) => {
					if (!isObject(word)) {
						throw new Error("Generated vocabulary word is invalid.");
					}
					return {
						term: requiredString(word.term, "vocabulary term"),
						meaning: requiredString(word.meaning, "vocabulary meaning"),
						partOfSpeech: requiredString(
							word.partOfSpeech,
							"vocabulary part of speech",
						),
						example: requiredString(word.example, "vocabulary example"),
					};
				}),
			};
		},
	},
	render: (block, ctx) => (
		<dl className="lesson-doc__words">
			{block.words.map((word) => (
				<div key={word.term} className="lesson-doc__word">
					<dt className="lesson-doc__word-term">
						{word.term}
						<span className="lesson-doc__word-pos">{word.partOfSpeech}</span>
						<SpeakButton
							id={`word-${word.term}`}
							text={word.term}
							ready={ctx.ready.has(word.term)}
							playing={ctx.playing}
							onPlay={ctx.onPlay}
						/>
					</dt>
					<dd className="lesson-doc__word-body">
						<span className="lesson-doc__word-meaning">{word.meaning}</span>
					</dd>
				</div>
			))}
		</dl>
	),
	toBotContext: (block) =>
		block.words
			.map((word) => `${word.term} (${word.partOfSpeech}) — ${word.meaning}`)
			.join("\n"),
};

const grammarBrick: LessonBodyBrickSpec<LessonGrammarBlock> = {
	example: {
		id: "grammar",
		type: "grammar",
		title: "Grammar",
		concepts: [
			{
				id: "using-en",
				title: "Using en",
				explanation: "`En` means in. It shows where something is.",
				examples: ["La kato estas en la domo."],
			},
		],
	},
	generation: {
		shape: {
			title: "Grammar point title",
			explanation: "Plain-English explanation",
			examples: ["Short Esperanto example"],
		},
		instructions:
			"Teach one compact grammar or usage point that helps with the introduced words and story. " +
			"Use one short English explanation. Include one to three short Esperanto examples. Put Esperanto forms in backticks when naming them.",
		example: {
			title: "Using en",
			explanation: "`En` means in. It shows where something is.",
			examples: ["La kato estas en la domo."],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.examples) ||
				value.examples.length < 1 ||
				value.examples.length > 3
			) {
				throw new Error("Generated grammar needs one to three examples.");
			}
			const title = requiredString(value.title, "grammar title");
			return {
				id: "grammar",
				type: "grammar",
				title: "Grammar",
				concepts: [
					{
						id: slugify(title, "grammar"),
						title,
						explanation: requiredString(
							value.explanation,
							"grammar explanation",
						),
						examples: value.examples.map((example) =>
							requiredString(example, "grammar example"),
						),
					},
				],
			};
		},
	},
	render: (block) =>
		block.concepts.map((concept) => (
			<div key={concept.id} className="lesson-doc__grammar">
				<h3 className="lesson-doc__subheading">{concept.title}</h3>
				<p className="lesson-doc__paragraph">
					{renderWithCode(concept.explanation)}
				</p>
				{concept.examples.map((example) => (
					<p key={example} className="lesson-doc__example">
						{example}
					</p>
				))}
			</div>
		)),
	toBotContext: (block) =>
		block.concepts
			.map((concept) =>
				[
					`${concept.title}: ${concept.explanation}`,
					concept.examples.length > 0
						? `Examples: ${concept.examples.join("; ")}`
						: undefined,
				]
					.filter(Boolean)
					.join("\n"),
			)
			.join("\n"),
};

const patternsBrick: LessonBodyBrickSpec<LessonPatternsBlock> = {
	example: {
		id: "patterns",
		type: "patterns",
		title: "Patterns",
		patterns: [
			{
				id: "subject-estas-place",
				title: "Subject + estas + place",
				slots: ["subject", "estas", "place"],
				examples: ["La kato estas en la domo."],
			},
		],
	},
	render: (block) =>
		block.patterns.map((pattern) => (
			<div key={pattern.id} className="lesson-doc__grammar">
				<h3 className="lesson-doc__subheading">{pattern.title}</h3>
				<p className="lesson-doc__paragraph">{pattern.slots.join(" + ")}</p>
				{pattern.examples.map((example) => (
					<p key={example} className="lesson-doc__example">
						{example}
					</p>
				))}
			</div>
		)),
	toBotContext: (block) =>
		block.patterns
			.map(
				(pattern) =>
					`${pattern.title}: ${pattern.slots.join(" + ")}. Examples: ${pattern.examples.join("; ")}`,
			)
			.join("\n"),
};

const storyBrick: LessonBodyBrickSpec<LessonStoryBlock> = {
	example: {
		id: "story",
		type: "story",
		title: "Your story",
		intro: "Read it aloud, then type it from memory on the next screen.",
		text: "La kato estas en la domo. La domo estas varma.",
		sentences: ["La kato estas en la domo.", "La domo estas varma."],
	},
	generation: {
		shape: {
			sentences: [
				"Short Esperanto sentence using introduced words",
				"Another short Esperanto sentence",
			],
		},
		instructions:
			"Write a tiny two to five sentence Esperanto practice story. " +
			"Use mostly the introduced words and very basic known words. Do not include English in the story.",
		example: {
			sentences: ["La kato estas en la domo.", "La domo estas varma."],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.sentences) ||
				value.sentences.length < 2 ||
				value.sentences.length > 5
			) {
				throw new Error("Generated story needs two to five sentences.");
			}
			const sentences = value.sentences.map((sentence) =>
				requiredString(sentence, "story sentence"),
			);
			return {
				id: "story",
				type: "story",
				title: "Your story",
				intro: "Read it aloud, then type it from memory on the next screen.",
				text: sentences.join(" "),
				sentences,
			};
		},
	},
	render: (block, ctx) => (
		<>
			<p className="lesson-doc__paragraph">{block.intro}</p>
			<blockquote className="lesson-doc__story">
				{block.text}
				<SpeakButton
					id="story"
					text={block.text}
					ready={ctx.ready.has(block.text)}
					playing={ctx.playing}
					onPlay={ctx.onPlay}
				/>
			</blockquote>
		</>
	),
	toBotContext: (block) => block.text,
};

const teachingBrick: LessonBodyBrickSpec<LessonTeachingSection> = {
	example: {
		id: "teaching",
		type: "overview",
		title: "A cat at home",
		body: [
			"This lesson uses a tiny home scene to practice saying where something is.",
		],
	},
	generation: {
		shape: {
			title: "Teaching point title",
			body: [
				"Plain-English explanation paragraph",
				"Optional second paragraph",
			],
		},
		instructions:
			"Give a short learner-facing overview of the lesson theme, context, or communication goal. " +
			"Use one or two short English paragraphs. Do not introduce a second standalone grammar rule; leave grammar mechanics to the grammar brick.",
		example: {
			title: "A cat at home",
			body: [
				"This lesson uses a tiny home scene to practice saying where something is.",
			],
		},
		parse(value) {
			if (
				!isObject(value) ||
				!Array.isArray(value.body) ||
				value.body.length < 1 ||
				value.body.length > 2
			) {
				throw new Error(
					"Generated teaching overview needs one or two paragraphs.",
				);
			}
			return {
				id: "teaching",
				type: "overview",
				title: requiredString(value.title, "teaching title"),
				body: value.body.map((paragraph) =>
					requiredString(paragraph, "teaching paragraph"),
				),
			};
		},
	},
	render: (block) => renderTeachingSection(block),
	toBotContext: (block) => describeTeachingSection(block),
};

type ExactLessonBodyBrickSpec = {
	[K in LessonBodyBlock["type"]]: LessonBodyBrickSpec<
		Extract<LessonBodyBlock, { type: K }>
	>;
}[LessonBodyBlock["type"]];

type LessonBodyBrickRegistry = Record<
	LessonBodyBlock["type"],
	ExactLessonBodyBrickSpec | LessonBodyBrickSpec<LessonTeachingSection>
>;

const LESSON_BODY_BRICKS: LessonBodyBrickRegistry = {
	overview: teachingBrick,
	"possessive-table": teachingBrick,
	"color-table": teachingBrick,
	examples: teachingBrick,
	vocabulary: vocabularyBrick,
	grammar: grammarBrick,
	patterns: patternsBrick,
	story: storyBrick,
};

export function lessonBodyBrickEntries(): [
	LessonBodyBlock["type"],
	LessonBodyBrickSpec<LessonBodyBlock>,
][] {
	return Object.entries(LESSON_BODY_BRICKS).map(([type, spec]) => [
		type as LessonBodyBlock["type"],
		spec as LessonBodyBrickSpec<LessonBodyBlock>,
	]);
}

function brickFor(
	block: LessonBodyBlock,
): LessonBodyBrickSpec<LessonBodyBlock> {
	return LESSON_BODY_BRICKS[block.type] as LessonBodyBrickSpec<LessonBodyBlock>;
}

export function renderLessonBodyBlock(
	block: LessonBodyBlock,
	ctx: LessonBodyRenderCtx,
): ReactNode {
	return brickFor(block).render(block, ctx);
}

export function describeLessonBodyBlock(block: LessonBodyBlock): string {
	return brickFor(block).toBotContext(block);
}

export const LESSON_GENERATABLE_BODY_BRICK_TYPES = [
	"vocabulary",
	"grammar",
	"overview",
	"story",
] as const;

export type LessonGeneratableBodyBrickType =
	(typeof LESSON_GENERATABLE_BODY_BRICK_TYPES)[number];

export const VOCABULARY_BODY_BRICK_TYPE = "vocabulary";
export const STORY_BODY_BRICK_TYPE = "story";

export function lessonBodyGenerationSpec(
	type: LessonGeneratableBodyBrickType,
): GenerationSpec<LessonBodyBlock> {
	const generation = LESSON_BODY_BRICKS[type].generation;
	if (!generation) throw new Error(`${type} cannot generate lesson content.`);
	return generation as GenerationSpec<LessonBodyBlock>;
}
