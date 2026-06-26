import type { LessonProgress } from "./lessonProgress";
import "./lesson.css";

interface LessonMenuItem {
	id: string;
	title: string;
	description: string;
	path: string;
	completedStageIds: string[];
}

interface LessonsMenuProps {
	progress: LessonProgress;
	items: LessonMenuItem[];
	onBack: () => void;
	onContinue: () => void;
	onOpenLessonPath: (path: string) => void;
}

export default function LessonsMenu({
	progress,
	items,
	onBack,
	onContinue,
	onOpenLessonPath,
}: LessonsMenuProps) {
	const completedStages = new Set(progress.completedStages);

	return (
		<div className="lesson-page lesson-menu-page">
			<section
				className="lesson-doc lesson-menu"
				aria-labelledby="lessons-title"
			>
				<button type="button" className="lesson-doc__back" onClick={onBack}>
					← Back to main menu
				</button>

				<p className="lesson-doc__eyebrow">Course menu</p>
				<h1 id="lessons-title" className="lesson-doc__title">
					Lessons
				</h1>
				<p className="lesson-doc__lede">
					Pick up where you left off, or revisit a finished section.
				</p>

				<div className="lesson-menu__actions">
					<button
						type="button"
						className="lesson-doc__begin"
						onClick={onContinue}
					>
						Continue Lesson
					</button>
				</div>

				<div className="lesson-menu__list">
					{items.map((item, index) => {
						const complete = item.completedStageIds.every((stageId) =>
							completedStages.has(stageId),
						);
						const current = progress.lastPath.startsWith(item.path);

						return (
							<button
								key={item.id}
								type="button"
								className={`lesson-menu__item${complete ? " lesson-menu__item--complete" : ""}${current ? " lesson-menu__item--current" : ""}`}
								onClick={() => onOpenLessonPath(item.path)}
							>
								<span className="lesson-menu__index">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span className="lesson-menu__body">
									<span className="lesson-menu__title">{item.title}</span>
									<span className="lesson-menu__description">
										{item.description}
									</span>
								</span>
								{complete && (
									<span className="lesson-menu__status lesson-menu__status--done">
										✓
									</span>
								)}
								{!complete && current && (
									<span className="lesson-menu__status lesson-menu__status--current">
										→
									</span>
								)}
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);
}
