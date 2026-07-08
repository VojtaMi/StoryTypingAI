import type { LessonPatternsBlock } from "../../types";

export function PatternsBlock({ block }: { block: LessonPatternsBlock }) {
	return block.patterns.map((pattern) => (
		<div key={pattern.id} className="lesson-doc__pattern">
			{pattern.title && (
				<h3 className="lesson-doc__subheading">{pattern.title}</h3>
			)}
			<p className="lesson-doc__slots">
				{pattern.slots.map((slot, index) => (
					<span key={slot} className="lesson-doc__slot-group">
						{index > 0 && <span className="lesson-doc__slot-plus">+</span>}
						<span className="lesson-doc__slot">{slot}</span>
					</span>
				))}
			</p>
			{pattern.examples.map((example) => (
				<p key={example} className="lesson-doc__example">
					{example}
				</p>
			))}
		</div>
	));
}
