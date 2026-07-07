type GeminiPart = {
	inlineData?: {
		data?: string;
		mimeType?: string;
	};
	text?: string;
};

type GeminiCandidate = {
	content?: {
		parts?: GeminiPart[];
	};
	finishReason?: string;
	safetyRatings?: unknown;
};

type GeminiResponseSummaryInput = {
	candidates?: GeminiCandidate[];
	promptFeedback?: unknown;
	usageMetadata?: unknown;
};

export function summarizeGeminiResponse(json: GeminiResponseSummaryInput) {
	return {
		candidateCount: json.candidates?.length ?? 0,
		candidates: json.candidates?.map((candidate, index) => ({
			index,
			finishReason: candidate.finishReason,
			parts: candidate.content?.parts?.map(summarizeGeminiPart) ?? [],
			safetyRatings: candidate.safetyRatings,
		})),
		promptFeedback: json.promptFeedback,
		usageMetadata: json.usageMetadata,
	};
}

function summarizeGeminiPart(part: GeminiPart) {
	if (part.inlineData) {
		return {
			type: "inlineData",
			dataChars: part.inlineData.data?.length ?? 0,
			mimeType: part.inlineData.mimeType,
		};
	}
	if (part.text !== undefined) {
		return {
			type: "text",
			chars: part.text.length,
			preview: part.text.slice(0, 500),
		};
	}
	return { type: "unknown" };
}
