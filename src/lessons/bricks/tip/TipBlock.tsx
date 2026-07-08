import type { LessonTipBlock } from "../../types";
import { renderWithCode } from "../teaching/TeachingBrick";

export function TipBlock({ block }: { block: LessonTipBlock }) {
	return (
		<div className="lesson-doc__tip">
			<div className="lesson-doc__tip-body">
				{block.body.map((paragraph) => (
					<p key={paragraph} className="lesson-doc__paragraph">
						{renderWithCode(paragraph)}
					</p>
				))}
			</div>
		</div>
	);
}
