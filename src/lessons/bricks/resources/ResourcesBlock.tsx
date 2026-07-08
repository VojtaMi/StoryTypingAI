import type { LessonResourcesBlock } from "../../types";
import { renderWithCode } from "../teaching/TeachingBrick";

export function ResourcesBlock({ block }: { block: LessonResourcesBlock }) {
	return (
		<ul className="lesson-resources">
			{block.resources.map((resource) => (
				<li key={resource.title} className="lesson-resources__item">
					{resource.type === "link" ? (
						<a
							className="lesson-resources__link"
							href={resource.url}
							target="_blank"
							rel="noreferrer"
						>
							{resource.title}
							<span aria-hidden="true"> ↗</span>
						</a>
					) : (
						<>
							<span className="lesson-resources__title">{resource.title}</span>
							<span className="lesson-resources__note">
								{renderWithCode(resource.content)}
							</span>
						</>
					)}
				</li>
			))}
		</ul>
	);
}
