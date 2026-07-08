import {
	type ExerciseBrickSpec,
	exerciseBrickEntries,
	type LessonBodyBlock,
	type LessonBodyBrickSpec,
	type LessonBodyRenderCtx,
	lessonBodyBrickEntries,
	renderExerciseBrick,
	renderLessonBodyBlock,
} from "../../lessons/bricks";
import "../../lessons/lesson.css";
import { firstLesson } from "../../lessons/predefined/lessons";
import type { LessonExercise } from "../../lessons/types";
import "./brickGallery.css";

type GenerationKind = "model-authored" | "derived" | "neither";

interface ParseGeneration<T> {
	instructions: string;
	shape: unknown;
	example: unknown;
	parse(value: unknown): T;
}

interface CreateGeneration<T> {
	create(): T;
}

interface GroupedEntry<Key extends string, Spec> {
	keys: Key[];
	spec: Spec;
}

const BRICK_GALLERY_PATH = "/bricks";

const bodyRenderCtx: LessonBodyRenderCtx = {
	ready: new Set<string>(),
	playing: null,
	onPlay: () => {},
};

const exerciseCtx = {
	lesson: firstLesson,
	lessonId: firstLesson.id,
	backgroundIntro: "",
	onComplete: () => {},
	onBack: () => {},
};

function groupBySpec<Key extends string, Spec>(
	entries: [Key, Spec][],
): GroupedEntry<Key, Spec>[] {
	const groups: GroupedEntry<Key, Spec>[] = [];

	for (const [key, spec] of entries) {
		const existing = groups.find((group) => group.spec === spec);
		if (existing) {
			existing.keys.push(key);
		} else {
			groups.push({ keys: [key], spec });
		}
	}

	return groups;
}

function hasParseGeneration<T>(
	generation: unknown,
): generation is ParseGeneration<T> {
	if (typeof generation !== "object" || generation === null) return false;
	const candidate = generation as { parse?: unknown };
	return typeof candidate.parse === "function";
}

function hasCreateGeneration<T>(
	generation: unknown,
): generation is CreateGeneration<T> {
	if (typeof generation !== "object" || generation === null) return false;
	const candidate = generation as { create?: unknown };
	return typeof candidate.create === "function";
}

function generationKind<T>(generation: unknown): GenerationKind {
	if (hasParseGeneration<T>(generation)) return "model-authored";
	if (hasCreateGeneration<T>(generation)) return "derived";
	return "neither";
}

function renderFixture<T>(spec: { example: T; generation?: unknown }): T {
	if (hasParseGeneration<T>(spec.generation)) {
		return spec.generation.parse(spec.generation.example);
	}
	return spec.example;
}

function formatJson(value: unknown) {
	return JSON.stringify(value, null, 2);
}

function brickHref(key: string) {
	return `${BRICK_GALLERY_PATH}/${encodeURIComponent(key)}`;
}

function selectedBrickKey() {
	const { hash, pathname } = window.location;

	if (pathname.startsWith(`${BRICK_GALLERY_PATH}/`)) {
		const key = pathname.slice(BRICK_GALLERY_PATH.length + 1).split("/")[0];
		return decodeURIComponent(key);
	}

	if (hash.startsWith("#")) {
		return decodeURIComponent(hash.slice(1));
	}

	return null;
}

function BrickHeader({
	specName,
	keys,
	kind,
}: {
	specName: string;
	keys: readonly string[];
	kind: GenerationKind;
}) {
	return (
		<header className="brick-gallery__brick-header">
			<div>
				<p className="brick-gallery__label">Spec</p>
				<h2 className="brick-gallery__brick-title">{specName}</h2>
			</div>
			<div className="brick-gallery__meta">
				<span className="brick-gallery__pill">{kind}</span>
				<div className="brick-gallery__aliases">
					{keys.map((key) => (
						<a key={key} href={brickHref(key)}>
							<code>{key}</code>
						</a>
					))}
				</div>
			</div>
		</header>
	);
}

function GenerationDetails<T>({ generation }: { generation: unknown }) {
	if (!hasParseGeneration<T>(generation)) return null;

	return (
		<section className="brick-gallery__generation">
			<div>
				<h3>Instructions</h3>
				<pre>{generation.instructions}</pre>
			</div>
			<div className="brick-gallery__json-pair">
				<div>
					<h3>Shape</h3>
					<pre>{formatJson(generation.shape)}</pre>
				</div>
				<div>
					<h3>Example</h3>
					<pre>{formatJson(generation.example)}</pre>
				</div>
			</div>
		</section>
	);
}

function BodyBrickCard({
	group,
}: {
	group: GroupedEntry<string, LessonBodyBrickSpec<LessonBodyBlock>>;
}) {
	const block = renderFixture(group.spec);
	const kind = generationKind<LessonBodyBlock>(group.spec.generation);

	return (
		<article className="brick-gallery__brick">
			<BrickHeader specName={block.type} keys={group.keys} kind={kind} />
			<div className="brick-gallery__preview brick-gallery__preview--body">
				<article className="lesson-doc" aria-label={`${block.title} preview`}>
					<section className="lesson-doc__section">
						<h2 className="lesson-doc__heading">{block.title}</h2>
						{renderLessonBodyBlock(block, bodyRenderCtx)}
					</section>
				</article>
			</div>
			<GenerationDetails<LessonBodyBlock> generation={group.spec.generation} />
		</article>
	);
}

function ExerciseBrickCard({
	group,
}: {
	group: GroupedEntry<string, ExerciseBrickSpec<LessonExercise>>;
}) {
	const exercise = renderFixture(group.spec);
	const kind = generationKind<LessonExercise>(group.spec.generation);

	return (
		<article className="brick-gallery__brick">
			<BrickHeader specName={exercise.type} keys={group.keys} kind={kind} />
			<div className="brick-gallery__preview brick-gallery__preview--exercise">
				{renderExerciseBrick(exercise, exerciseCtx)}
			</div>
			<GenerationDetails<LessonExercise> generation={group.spec.generation} />
		</article>
	);
}

export default function BrickGallery() {
	const selectedKey = selectedBrickKey();
	const bodyGroups = groupBySpec(lessonBodyBrickEntries());
	const exerciseGroups = groupBySpec(exerciseBrickEntries());
	const visibleBodyGroups = selectedKey
		? bodyGroups.filter((group) =>
				group.keys.some((key) => key === selectedKey),
			)
		: bodyGroups;
	const visibleExerciseGroups = selectedKey
		? exerciseGroups.filter((group) =>
				group.keys.some((key) => key === selectedKey),
			)
		: exerciseGroups;
	const hasSelectedBrick =
		visibleBodyGroups.length > 0 || visibleExerciseGroups.length > 0;

	return (
		<main className="brick-gallery">
			<header className="brick-gallery__page-header">
				<p className="brick-gallery__label">Dev workbench</p>
				<h1>Lesson brick gallery</h1>
				<p className="brick-gallery__intro">
					Every brick renders from its fixture through the same registry used by
					lessons. Shared specs keep all registry aliases visible.
				</p>
				{selectedKey && (
					<p className="brick-gallery__filter">
						Showing <code>{selectedKey}</code>.{" "}
						<a href={BRICK_GALLERY_PATH}>View all bricks</a>
					</p>
				)}
			</header>

			{!hasSelectedBrick && selectedKey && (
				<section className="brick-gallery__section">
					<p className="brick-gallery__empty">
						No brick registered as <code>{selectedKey}</code>.
					</p>
				</section>
			)}

			{visibleBodyGroups.length > 0 && (
				<section
					className="brick-gallery__section"
					aria-labelledby="body-bricks"
				>
					<h2 id="body-bricks">Body bricks</h2>
					<div className="brick-gallery__stack">
						{visibleBodyGroups.map((group) => (
							<BodyBrickCard key={group.keys.join("|")} group={group} />
						))}
					</div>
				</section>
			)}

			{visibleExerciseGroups.length > 0 && (
				<section
					className="brick-gallery__section"
					aria-labelledby="exercise-bricks"
				>
					<h2 id="exercise-bricks">Exercise bricks</h2>
					<div className="brick-gallery__stack">
						{visibleExerciseGroups.map((group) => (
							<ExerciseBrickCard key={group.keys.join("|")} group={group} />
						))}
					</div>
				</section>
			)}
		</main>
	);
}
