import type { LessonPatternsBlock } from "./index";

export function PatternsBlock({ block }: { block: LessonPatternsBlock }) {
	return block.patterns.map((pattern) => (
		<div key={pattern.id} className="lesson-doc__grammar">
			<h3 className="lesson-doc__subheading">{pattern.title}</h3>
			<p className="lesson-doc__paragraph">{pattern.slots.join(" + ")}</p>
			{pattern.examples.map((example) => (
				<p key={example} className="lesson-doc__example">
					{example}
				</p>
			))}
		</div>
	));
}
