import type { ReactNode } from "react";
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

interface LessonBodyBrickSpec<T extends LessonBodyBlock> {
	render(block: T, ctx: LessonBodyRenderCtx): ReactNode;
	toBotContext(block: T): string;
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
	render: (block) => renderTeachingSection(block),
	toBotContext: (block) => describeTeachingSection(block),
};

type LessonBodyBrickRegistry = {
	[K in LessonBodyBlock["type"]]: LessonBodyBrickSpec<
		Extract<LessonBodyBlock, { type: K }>
	>;
};

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
