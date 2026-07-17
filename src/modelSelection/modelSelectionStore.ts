import {
	DEFAULT_CHAT_MODEL,
	DEFAULT_TEXT_MODEL,
	TEXT_MODELS,
	type TextModelId,
} from "../models";
import { DEFAULT_TTS_MODEL, isTtsModelId, type TtsModelId } from "../ttsModel";

const MODEL_STORAGE_KEY = "ai-model";
const CHAT_MODEL_STORAGE_KEY = "chat-model";
const NARRATION_MODEL_STORAGE_KEY = "narration-model";

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

export function readSelectedNarrationModel(): TtsModelId {
	const stored = localStorage.getItem(NARRATION_MODEL_STORAGE_KEY);
	return isTtsModelId(stored) ? stored : DEFAULT_TTS_MODEL;
}

export function saveSelectedNarrationModel(id: TtsModelId) {
	localStorage.setItem(NARRATION_MODEL_STORAGE_KEY, id);
}
