import { renderWithCode } from "../teaching/TeachingBrick";
import type { LessonGrammarBlock } from "./index";

export function GrammarBlock({ block }: { block: LessonGrammarBlock }) {
	return block.concepts.map((concept) => (
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
	));
}
