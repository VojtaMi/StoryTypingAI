import type { Genre } from "../genres";
import { ModelSelector } from "../modelSelection/ModelSelector";
import type { TextModelId } from "../models";
import type { SavedStorySummary } from "../saves";
import "./menu.css";
import { NewStoryGrid } from "./newStory/SelectionGrid";
import { SavedStories } from "./savedStories/SavedStories";

interface MainMenuProps {
	savedStories: SavedStorySummary[];
	savesError: string | null;
	model: TextModelId;
	onModelChange: (id: TextModelId) => void;
	onSelect: (genre: Genre) => void;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export default function MainMenu({
	savedStories,
	savesError,
	model,
	onModelChange,
	onSelect,
	onResume,
	onDelete,
}: MainMenuProps) {
	return (
		<div className="menu">
			<ModelSelector model={model} onModelChange={onModelChange} />
			<NewStoryGrid onSelect={onSelect} />
			<SavedStories
				savedStories={savedStories}
				savesError={savesError}
				onResume={onResume}
				onDelete={onDelete}
			/>
		</div>
	);
}
