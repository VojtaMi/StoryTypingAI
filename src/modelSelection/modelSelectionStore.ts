import { DEFAULT_TEXT_MODEL, TEXT_MODELS, type TextModelId } from "../models";

const MODEL_STORAGE_KEY = "ai-model";

export function readSelectedTextModel(): TextModelId {
	const stored = localStorage.getItem(MODEL_STORAGE_KEY);
	return (
		TEXT_MODELS.find((model) => model.id === stored)?.id ?? DEFAULT_TEXT_MODEL
	);
}

export function saveSelectedTextModel(id: TextModelId) {
	localStorage.setItem(MODEL_STORAGE_KEY, id);
}
