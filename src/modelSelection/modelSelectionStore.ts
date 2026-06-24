import {
	DEFAULT_CHAT_MODEL,
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	type TextModelId,
} from "../models";

const MODEL_STORAGE_KEY = "ai-model";
const CHAT_MODEL_STORAGE_KEY = "chat-model";

export function readSelectedTextModel(): TextModelId {
	const stored = localStorage.getItem(MODEL_STORAGE_KEY);
	return (
		TEXT_MODELS.find((model) => model.id === stored)?.id ?? DEFAULT_TEXT_MODEL
	);
}

export function saveSelectedTextModel(id: TextModelId) {
	localStorage.setItem(MODEL_STORAGE_KEY, id);
}

export function readSelectedChatModel(): TextModelId {
	const stored = localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
	return (
		TEXT_MODELS.find((model) => model.id === stored)?.id ?? DEFAULT_CHAT_MODEL
	);
}

export function saveSelectedChatModel(id: TextModelId) {
	localStorage.setItem(CHAT_MODEL_STORAGE_KEY, id);
}
