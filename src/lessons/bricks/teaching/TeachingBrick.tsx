import { Fragment, type ReactNode } from "react";
import type {
	LessonColorTableSection,
	LessonExamplesSection,
	LessonOverviewSection,
	LessonPossessiveTableSection,
	LessonTeachingSection,
} from "../../types";

/** Renders text with inline `code` spans marked by backticks. */
export function renderWithCode(text: string): ReactNode {
	return text.split("`").map((part, index) =>
		index % 2 === 1 ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable split
			<code key={index} className="lesson-doc__code">
				{part}
			</code>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable split
			<Fragment key={index}>{part}</Fragment>
		),
	);
}

/**
 * A teaching brick owns everything a single teaching-section variant needs:
 * how it renders inside the lesson doc, and how it describes itself to the
 * tutor bot. Adding a variant means adding one spec here rather than editing a
 * render switch in LessonIntro and a separate text switch in lessonBotContext.
 *
 * Capabilities are added on demand: `render` and `describeForBot` exist because
 * both have real consumers today. Generation capabilities (shape/instructions/
 * parse) join the same specs when the AI-authoring layer lands.
 */
export interface TeachingBrickSpec<T extends LessonTeachingSection> {
	/** Renders the body below the numbered section heading. */
	render(section: T): ReactNode;
	/**
	 * Projects the section's body to plain text for the tutor bot's context.
	 * Omit the title — `buildLessonBotContext` heads every block with it, the
	 * same way `LessonIntro` heads every rendered block with it.
	 */
	describeForBot(section: T): string;
}

const overviewBrick: TeachingBrickSpec<LessonOverviewSection> = {
	render: (section) =>
		section.body.map((paragraph) => (
			<p key={paragraph} className="lesson-doc__paragraph">
				{renderWithCode(paragraph)}
			</p>
		)),
	describeForBot: (section) => section.body.join("\n"),
};

const possessiveTableBrick: TeachingBrickSpec<LessonPossessiveTableSection> = {
	render: (section) => (
		<table className="lesson-table">
			<thead>
				<tr className="lesson-table__row lesson-table__row--head">
					<th scope="col">Pronoun</th>
					<th scope="col">Meaning</th>
					<th scope="col">Adjective</th>
					<th scope="col">Meaning</th>
				</tr>
			</thead>
			<tbody>
				{section.rows.map((row) => (
					<tr
						key={`${row.pronoun}-${row.possessive}`}
						className="lesson-table__row"
					>
						<td className="lesson-table__term">{row.pronoun}</td>
						<td>{row.pronounMeaning}</td>
						<td className="lesson-table__term">{row.possessive}</td>
						<td>{row.possessiveMeaning}</td>
					</tr>
				))}
			</tbody>
		</table>
	),
	describeForBot: (section) =>
		section.rows
			.map(
				(row) =>
					`${row.pronoun} (${row.pronounMeaning}) → ${row.possessive} (${row.possessiveMeaning})`,
			)
			.join("\n"),
};

const colorTableBrick: TeachingBrickSpec<LessonColorTableSection> = {
	render: (section) => (
		<table className="lesson-color-table">
			<tbody>
				{section.rows.map((row) => (
					<tr key={row.term} className="lesson-color-table__row">
						<td className="lesson-color-table__swatch-cell">
							<span
								className="lesson-color-table__swatch"
								style={{ backgroundColor: row.color }}
								aria-hidden="true"
							/>
						</td>
						<td className="lesson-table__term">{row.term}</td>
						<td>{row.meaning}</td>
					</tr>
				))}
			</tbody>
		</table>
	),
	describeForBot: (section) =>
		section.rows.map((row) => `${row.term} — ${row.meaning}`).join("\n"),
};

const examplesBrick: TeachingBrickSpec<LessonExamplesSection> = {
	render: (section) => (
		<div className="lesson-examples">
			{section.examples.map((example) => (
				<div key={example.phrase} className="lesson-examples__row">
					<span className="lesson-examples__phrase">{example.phrase}</span>
					<span className="lesson-examples__meaning">{example.meaning}</span>
				</div>
			))}
		</div>
	),
	describeForBot: (section) =>
		section.examples
			.map((example) => `${example.phrase} — ${example.meaning}`)
			.join("\n"),
};

type TeachingBrickRegistry = {
	[K in LessonTeachingSection["type"]]: TeachingBrickSpec<
		Extract<LessonTeachingSection, { type: K }>
	>;
};

const TEACHING_BRICKS: TeachingBrickRegistry = {
	overview: overviewBrick,
	"possessive-table": possessiveTableBrick,
	"color-table": colorTableBrick,
	examples: examplesBrick,
};

/**
 * Looks up a section's brick by its discriminant. The cast is the one place
 * that reconciles the registry's per-variant typing with a runtime `type`
 * string — every caller past here stays type-safe.
 */
function brickFor(
	section: LessonTeachingSection,
): TeachingBrickSpec<LessonTeachingSection> {
	return TEACHING_BRICKS[
		section.type
	] as TeachingBrickSpec<LessonTeachingSection>;
}

export function renderTeachingSection(
	section: LessonTeachingSection,
): ReactNode {
	return brickFor(section).render(section);
}

export function describeTeachingSection(
	section: LessonTeachingSection,
): string {
	return brickFor(section).describeForBot(section);
}
