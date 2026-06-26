import { useCallback, useEffect, useRef, useState } from "react";
import {
	autoContinueStoryStream,
	type ChatMessage,
	continueStoryStream,
	generateOpeningAudio,
	generateStoryBackgroundImage,
	generateStoryIntro,
	type StoryMemory,
	startStory,
} from "../ai";
import type {
	StoryPhase,
	StorySegment,
	TypingStats,
} from "../exercise_screen/types";
import { type Genre, genres } from "../genres";
import type { TextModelId } from "../models";
import {
	DEFAULT_NARRATION_VOICE,
	isNarrationVoiceId,
	type NarrationVoiceId,
	pickRandomNarrationVoice,
} from "../narrationVoice";
import { consumePreparedOpening, prepareMissingOpenings } from "../openings";
import { loadSavedStory } from "../saves";
import type { StoryOpeningAudio } from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import {
	backgroundFromOpening,
	fallbackBackgroundImage,
	shouldGenerateNextBackground,
} from "./background";
import { useStoryPersistence } from "./persistence/useStoryPersistence";
import {
	buildStorySaveSnapshot,
	createSaveId,
	fallbackTitle,
} from "./storySnapshot";

type View = "menu" | "lesson" | "word-match" | "lesson-typing" | "story";

interface UseStorySessionOptions {
	model: TextModelId;
	view: View;
	onViewChange: (view: View) => void;
	onSavedStoriesChanged: () => Promise<void>;
	onSavesError: (error: string | null) => void;
}

function describeError(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	return `Something went wrong reaching the AI: ${message}`;
}

export function useStorySession({
	model,
	view,
	onViewChange,
	onSavedStoriesChanged,
	onSavesError,
}: UseStorySessionOptions) {
	const [genre, setGenre] = useState<Genre | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [memory, setMemory] = useState<StoryMemory | undefined>();
	const [segments, setSegments] = useState<StorySegment[]>([]);
	const [currentTarget, setCurrentTarget] = useState<string | null>(null);
	const [streamingTarget, setStreamingTarget] = useState("");
	const [phase, setPhase] = useState<StoryPhase>("loading");
	const [error, setError] = useState<string | null>(null);
	const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
	const [activeTitle, setActiveTitle] = useState<string | null>(null);
	const [backgroundIntro, setBackgroundIntro] = useState<string | null>(null);
	const [backgroundImage, setBackgroundImage] =
		useState<StoryBackgroundImage | null>(null);
	const [openingAudio, setOpeningAudio] = useState<StoryOpeningAudio | null>(
		null,
	);
	const [narrationVoice, setNarrationVoice] = useState<NarrationVoiceId>(
		DEFAULT_NARRATION_VOICE,
	);
	const activeSaveIdRef = useRef<string | null>(null);
	const activeTitleRef = useRef<string | null>(null);
	const messagesRef = useRef<ChatMessage[]>([]);
	const memoryRef = useRef<StoryMemory | undefined>(undefined);
	const segmentsRef = useRef<StorySegment[]>([]);
	const currentTargetRef = useRef<string | null>(null);
	const phaseRef = useRef<StoryPhase>("loading");
	const openingAudioRef = useRef<StoryOpeningAudio | null>(null);
	const narrationVoiceRef = useRef<NarrationVoiceId>(DEFAULT_NARRATION_VOICE);
	const preparingOpeningsRef = useRef(false);
	const prepareOpeningsAgainRef = useRef(false);

	useEffect(() => {
		activeSaveIdRef.current = activeSaveId;
	}, [activeSaveId]);

	useEffect(() => {
		activeTitleRef.current = activeTitle;
	}, [activeTitle]);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	useEffect(() => {
		memoryRef.current = memory;
	}, [memory]);

	useEffect(() => {
		segmentsRef.current = segments;
	}, [segments]);

	useEffect(() => {
		currentTargetRef.current = currentTarget;
	}, [currentTarget]);

	useEffect(() => {
		phaseRef.current = phase;
	}, [phase]);

	useEffect(() => {
		openingAudioRef.current = openingAudio;
	}, [openingAudio]);

	useEffect(() => {
		narrationVoiceRef.current = narrationVoice;
	}, [narrationVoice]);

	const persistStory = useStoryPersistence({
		model,
		activeSaveIdRef,
		onSavedStoriesChanged,
		onSavesError,
		onTitleGenerated: setActiveTitle,
	});

	const generateAndApplyStoryBackground = useCallback(
		async (selected: Genre, saveId: string, storyMessages: ChatMessage[]) => {
			try {
				const nextBackgroundImage = await generateStoryBackgroundImage(
					selected.id,
					storyMessages,
					saveId,
				);
				if (
					activeSaveIdRef.current !== saveId ||
					nextBackgroundImage.backgroundImageSource !== "generated"
				) {
					return;
				}

				setBackgroundImage(nextBackgroundImage);
				void persistStory(
					buildStorySaveSnapshot({
						id: saveId,
						genre: selected,
						title: activeTitleRef.current ?? fallbackTitle(selected),
						messages: messagesRef.current,
						memory: memoryRef.current,
						segments: segmentsRef.current,
						currentTarget: currentTargetRef.current,
						phase: phaseRef.current,
						backgroundImage: nextBackgroundImage,
						openingAudio: openingAudioRef.current,
						narrationVoice: narrationVoiceRef.current,
					}),
				);
			} catch (err) {
				console.warn("Could not refresh the story background image.", err);
			}
		},
		[persistStory],
	);

	const refreshStoryBackground = useCallback(
		async (selected: Genre, saveId: string, storyMessages: ChatMessage[]) => {
			if (!shouldGenerateNextBackground(storyMessages)) return;
			await generateAndApplyStoryBackground(selected, saveId, storyMessages);
		},
		[generateAndApplyStoryBackground],
	);

	const prepareOpeningsInBackground = useCallback(async () => {
		if (preparingOpeningsRef.current) {
			prepareOpeningsAgainRef.current = true;
			return;
		}
		preparingOpeningsRef.current = true;
		try {
			await prepareMissingOpenings(model);
		} catch (err) {
			console.warn("Could not prepare story openings.", err);
		} finally {
			preparingOpeningsRef.current = false;
			if (prepareOpeningsAgainRef.current) {
				prepareOpeningsAgainRef.current = false;
				void prepareOpeningsInBackground();
			}
		}
	}, [model]);

	useEffect(() => {
		void (async () => {
			await onSavedStoriesChanged();
			void prepareOpeningsInBackground();
		})();
	}, [onSavedStoriesChanged, prepareOpeningsInBackground]);

	useEffect(() => {
		if (view === "menu") void prepareOpeningsInBackground();
	}, [view, prepareOpeningsInBackground]);

	const selectGenre = useCallback(
		async (selected: Genre) => {
			const title = fallbackTitle(selected);

			setGenre(selected);
			setMessages([]);
			setMemory(undefined);
			setSegments([]);
			setCurrentTarget(null);
			setStreamingTarget("");
			setError(null);
			setOpeningAudio(null);
			setPhase("loading");
			onViewChange("story");
			try {
				let opening: {
					id?: string;
					text: string;
					messages: ChatMessage[];
					backgroundIntro?: string;
					backgroundImageUrl?: string;
					backgroundImagePrompt?: string;
					backgroundImageSource?: string;
					openingAudioUrl?: string;
					openingAudioSource?: "generated";
					openingAudioText?: string;
					openingAudioVoice?: NarrationVoiceId;
					narrationVoice?: NarrationVoiceId;
				} | null = null;
				let consumedPreparedOpening = false;
				try {
					opening = await consumePreparedOpening(selected.id);
					consumedPreparedOpening = Boolean(opening);
				} catch (err) {
					console.warn("Could not consume a prepared opening.", err);
				}
				void prepareOpeningsInBackground();

				if (!opening) {
					opening = await startStory(selected, model);
				}

				const saveId = opening.id ?? createSaveId();
				const nextNarrationVoice = isNarrationVoiceId(opening.narrationVoice)
					? opening.narrationVoice
					: pickRandomNarrationVoice();
				narrationVoiceRef.current = nextNarrationVoice;
				activeSaveIdRef.current = saveId;
				setActiveSaveId(saveId);
				setActiveTitle(title);
				setNarrationVoice(nextNarrationVoice);

				const { text, messages: seeded } = opening;
				const intro =
					opening.backgroundIntro ||
					(await generateStoryIntro(selected.label, text, model).catch(
						() => "",
					));
				const nextOpeningAudio =
					opening.openingAudioUrl &&
					opening.openingAudioSource === "generated" &&
					opening.openingAudioVoice === nextNarrationVoice
						? {
								openingAudioUrl: opening.openingAudioUrl,
								openingAudioSource: opening.openingAudioSource,
								openingAudioText: opening.openingAudioText ?? text,
								openingAudioVoice: opening.openingAudioVoice,
							}
						: await generateOpeningAudio(
								text,
								saveId,
								nextNarrationVoice,
							).catch((err) => {
								console.warn("Could not generate opening audio.", err);
								return null;
							});
				const nextBackgroundImage = backgroundFromOpening(opening, selected);
				setMessages(seeded);
				setMemory(undefined);
				setCurrentTarget(text);
				setStreamingTarget("");
				setBackgroundIntro(intro);
				setBackgroundImage(nextBackgroundImage);
				setOpeningAudio(nextOpeningAudio);
				setPhase("typing");
				void persistStory(
					buildStorySaveSnapshot({
						id: saveId,
						genre: selected,
						title,
						messages: seeded,
						memory: undefined,
						segments: [],
						currentTarget: text,
						phase: "typing",
						backgroundIntro: intro,
						backgroundImage: nextBackgroundImage,
						openingAudio: nextOpeningAudio,
						narrationVoice: nextNarrationVoice,
					}),
					{ generateTitle: true },
				);
				if (!consumedPreparedOpening) {
					void generateAndApplyStoryBackground(selected, saveId, seeded);
				}
			} catch (err) {
				setError(describeError(err));
			}
		},
		[
			generateAndApplyStoryBackground,
			model,
			onViewChange,
			persistStory,
			prepareOpeningsInBackground,
		],
	);

	const startLessonStory = useCallback(
		({ title, storyText }: { title: string; storyText: string }) => {
			const selected =
				genres.find((candidate) => candidate.id === "esperanto") ?? genres[0];
			const saveId = createSaveId();
			const nextNarrationVoice = pickRandomNarrationVoice();
			// Seed the history as if the AI had opened with the lesson sentence, so
			// the existing continuation flow works once the learner types it.
			const seeded: ChatMessage[] = [
				{ role: "system", content: selected.systemPrompt },
				{ role: "user", content: "Begin the story." },
				{ role: "assistant", content: storyText },
			];
			const nextBackgroundImage = fallbackBackgroundImage(selected);

			narrationVoiceRef.current = nextNarrationVoice;
			activeSaveIdRef.current = saveId;
			setGenre(selected);
			setActiveSaveId(saveId);
			setActiveTitle(title);
			setNarrationVoice(nextNarrationVoice);
			setMessages(seeded);
			setMemory(undefined);
			setSegments([]);
			setCurrentTarget(storyText);
			setStreamingTarget("");
			setBackgroundIntro(null);
			setBackgroundImage(nextBackgroundImage);
			setOpeningAudio(null);
			setError(null);
			setPhase("typing");
			onViewChange("story");
			void persistStory(
				buildStorySaveSnapshot({
					id: saveId,
					genre: selected,
					title,
					messages: seeded,
					memory: undefined,
					segments: [],
					currentTarget: storyText,
					phase: "typing",
					backgroundImage: nextBackgroundImage,
					openingAudio: null,
					narrationVoice: nextNarrationVoice,
				}),
			);
		},
		[onViewChange, persistStory],
	);

	const handleTypingComplete = useCallback(
		(_stats: TypingStats) => {
			if (currentTarget === null) return;
			const nextSegments: StorySegment[] = [
				...segments,
				{ id: segments.length, author: "ai", text: currentTarget },
			];
			setSegments(nextSegments);
			setCurrentTarget(null);
			setStreamingTarget("");
			setPhase("authoring");
			if (genre && activeSaveId) {
				void persistStory(
					buildStorySaveSnapshot({
						id: activeSaveId,
						genre,
						title: activeTitle ?? fallbackTitle(genre),
						messages,
						memory,
						segments: nextSegments,
						currentTarget: null,
						phase: "authoring",
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage,
						openingAudio,
						narrationVoice,
					}),
				);
			}
		},
		[
			activeSaveId,
			activeTitle,
			backgroundIntro,
			currentTarget,
			genre,
			memory,
			messages,
			persistStory,
			backgroundImage,
			openingAudio,
			narrationVoice,
			segments,
		],
	);

	const runContinuation = useCallback(
		async ({
			segmentsForSave,
			loadingMessages,
			streamContinuation,
		}: {
			segmentsForSave: StorySegment[];
			loadingMessages: ChatMessage[];
			streamContinuation: (onChunk: (chunk: string) => void) => Promise<{
				text: string;
				messages: ChatMessage[];
				memory?: StoryMemory;
			}>;
		}) => {
			if (!genre || !activeSaveId) return;

			setStreamingTarget("");
			setError(null);
			setPhase("loading");
			void persistStory(
				buildStorySaveSnapshot({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages: loadingMessages,
					memory,
					segments: segmentsForSave,
					currentTarget: null,
					phase: "loading",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio,
					narrationVoice,
				}),
			);

			try {
				const {
					text,
					messages: updated,
					memory: updatedMemory,
				} = await streamContinuation((chunk) =>
					setStreamingTarget((current) => current + chunk),
				);
				setMessages(updated);
				setMemory(updatedMemory);
				setCurrentTarget(text);
				setStreamingTarget("");
				setPhase("typing");
				void persistStory(
					buildStorySaveSnapshot({
						id: activeSaveId,
						genre,
						title: activeTitle ?? fallbackTitle(genre),
						messages: updated,
						memory: updatedMemory,
						segments: segmentsForSave,
						currentTarget: text,
						phase: "typing",
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage,
						openingAudio,
						narrationVoice,
					}),
					{ generateTitle: activeTitle === fallbackTitle(genre) },
				);
				void refreshStoryBackground(genre, activeSaveId, updated);
			} catch (err) {
				setError(describeError(err));
				setStreamingTarget("");
			}
		},
		[
			activeSaveId,
			activeTitle,
			backgroundImage,
			backgroundIntro,
			genre,
			memory,
			openingAudio,
			narrationVoice,
			persistStory,
			refreshStoryBackground,
		],
	);

	const submitContinuation = useCallback(
		async (userText: string) => {
			if (!genre || !activeSaveId) return;

			const nextSegments: StorySegment[] = [
				...segments,
				{ id: segments.length, author: "user", text: userText },
			];
			const userMessages: ChatMessage[] = [
				...messages,
				{ role: "user", content: userText },
			];

			setSegments(nextSegments);
			setMessages(userMessages);
			await runContinuation({
				segmentsForSave: nextSegments,
				loadingMessages: userMessages,
				streamContinuation: (onChunk) =>
					continueStoryStream(messages, userText, onChunk, model, memory),
			});
		},
		[activeSaveId, genre, memory, messages, model, runContinuation, segments],
	);

	const autoContinueStory = useCallback(async () => {
		if (!genre || !activeSaveId) return;

		await runContinuation({
			segmentsForSave: segments,
			loadingMessages: messages,
			streamContinuation: (onChunk) =>
				autoContinueStoryStream(messages, onChunk, model, memory),
		});
	}, [activeSaveId, genre, memory, messages, model, runContinuation, segments]);

	const backToMenu = useCallback(() => {
		if (genre && activeSaveId) {
			void persistStory(
				buildStorySaveSnapshot({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages,
					memory,
					segments,
					currentTarget,
					phase,
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio,
					narrationVoice,
				}),
			);
		}
		onViewChange("menu");
		setGenre(null);
		setMessages([]);
		setMemory(undefined);
		setSegments([]);
		setCurrentTarget(null);
		setStreamingTarget("");
		setError(null);
		setPhase("loading");
		setBackgroundIntro(null);
		setBackgroundImage(null);
		setOpeningAudio(null);
		setNarrationVoice(DEFAULT_NARRATION_VOICE);
		narrationVoiceRef.current = DEFAULT_NARRATION_VOICE;
		activeSaveIdRef.current = null;
		setActiveSaveId(null);
		setActiveTitle(null);
	}, [
		activeSaveId,
		activeTitle,
		backgroundIntro,
		currentTarget,
		genre,
		memory,
		messages,
		onViewChange,
		persistStory,
		phase,
		backgroundImage,
		openingAudio,
		narrationVoice,
		segments,
	]);

	const resumeStory = useCallback(
		async (id: string) => {
			try {
				onSavesError(null);
				const save = await loadSavedStory(id);
				const selected = genres.find(
					(candidate) => candidate.id === save.genreId,
				);
				if (!selected) throw new Error(`Unknown genre: ${save.genreId}`);
				activeSaveIdRef.current = save.id;
				setActiveSaveId(save.id);
				setActiveTitle(save.title);
				setGenre(selected);
				setMessages(save.messages);
				setMemory(save.memory);
				setSegments(save.segments);
				setCurrentTarget(save.currentTarget);
				setStreamingTarget("");
				setPhase(save.phase);
				const savedNarrationVoice = isNarrationVoiceId(save.narrationVoice)
					? save.narrationVoice
					: DEFAULT_NARRATION_VOICE;
				narrationVoiceRef.current = savedNarrationVoice;
				setNarrationVoice(savedNarrationVoice);
				setBackgroundIntro(save.backgroundIntro ?? null);
				setBackgroundImage(
					save.backgroundImageUrl &&
						(save.backgroundImageSource === "generated" ||
							save.backgroundImageSource === "fallback")
						? {
								backgroundImageUrl: save.backgroundImageUrl,
								backgroundImagePrompt: save.backgroundImagePrompt,
								backgroundImageSource: save.backgroundImageSource,
							}
						: fallbackBackgroundImage(selected),
				);
				setOpeningAudio(
					save.openingAudioUrl && save.openingAudioSource === "generated"
						? {
								openingAudioUrl: save.openingAudioUrl,
								openingAudioSource: save.openingAudioSource,
								openingAudioText:
									save.openingAudioText ?? save.currentTarget ?? "",
								openingAudioVoice: save.openingAudioVoice,
							}
						: null,
				);
				setError(null);
				onViewChange("story");
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				onSavesError(`Could not load story: ${message}`);
			}
		},
		[onSavesError, onViewChange],
	);

	return {
		activeSaveId,
		autoContinueStory,
		backToMenu,
		backgroundImage,
		backgroundIntro,
		currentTarget,
		error,
		genre,
		handleTypingComplete,
		phase,
		openingAudio:
			currentTarget &&
			openingAudio?.openingAudioText === currentTarget &&
			(!openingAudio.openingAudioVoice ||
				openingAudio.openingAudioVoice === narrationVoice)
				? openingAudio
				: null,
		narrationVoice,
		resumeStory,
		segments,
		selectGenre,
		startLessonStory,
		streamingTarget,
		submitContinuation,
	};
}
