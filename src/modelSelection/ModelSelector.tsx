import { TEXT_MODELS, type TextModelId } from "../models";

interface ModelSelectorProps {
	model: TextModelId;
	onModelChange: (id: TextModelId) => void;
}

export function ModelSelector({ model, onModelChange }: ModelSelectorProps) {
	return (
		<div className="menu__settings">
			<label htmlFor="model-select">AI model</label>
			<select
				id="model-select"
				value={model}
				onChange={(event) => onModelChange(event.target.value as TextModelId)}
			>
				{TEXT_MODELS.map((textModel) => (
					<option key={textModel.id} value={textModel.id}>
						{textModel.label}
					</option>
				))}
			</select>
		</div>
	);
}
