import { useCallback, useEffect, useRef, useState } from "react";
import {
	autoContinueStoryStream,
	type ChatMessage,
	continueStoryStream,
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
import { consumePreparedOpening, prepareMissingOpenings } from "../openings";
import { loadSavedStory } from "../saves";
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

type View = "menu" | "story";

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
	const activeSaveIdRef = useRef<string | null>(null);
	const activeTitleRef = useRef<string | null>(null);
	const messagesRef = useRef<ChatMessage[]>([]);
	const memoryRef = useRef<StoryMemory | undefined>(undefined);
	const segmentsRef = useRef<StorySegment[]>([]);
	const currentTargetRef = useRef<string | null>(null);
	const phaseRef = useRef<StoryPhase>("loading");
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
				activeSaveIdRef.current = saveId;
				setActiveSaveId(saveId);
				setActiveTitle(title);

				const { text, messages: seeded } = opening;
				const intro =
					opening.backgroundIntro ||
					(await generateStoryIntro(selected.label, text, model).catch(
						() => "",
					));
				const nextBackgroundImage = backgroundFromOpening(opening, selected);
				setMessages(seeded);
				setMemory(undefined);
				setCurrentTarget(text);
				setStreamingTarget("");
				setBackgroundIntro(intro);
				setBackgroundImage(nextBackgroundImage);
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
			segments,
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
			setStreamingTarget("");
			setError(null);
			setPhase("loading");
			void persistStory(
				buildStorySaveSnapshot({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages: userMessages,
					memory,
					segments: nextSegments,
					currentTarget: null,
					phase: "loading",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
				}),
			);

			try {
				const {
					text,
					messages: updated,
					memory: updatedMemory,
				} = await continueStoryStream(
					messages,
					userText,
					(chunk) => setStreamingTarget((current) => current + chunk),
					model,
					memory,
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
						segments: nextSegments,
						currentTarget: text,
						phase: "typing",
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage,
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
			backgroundIntro,
			genre,
			memory,
			messages,
			model,
			persistStory,
			refreshStoryBackground,
			backgroundImage,
			segments,
		],
	);

	const autoContinueStory = useCallback(async () => {
		if (!genre || !activeSaveId) return;

		setStreamingTarget("");
		setError(null);
		setPhase("loading");
		void persistStory(
			buildStorySaveSnapshot({
				id: activeSaveId,
				genre,
				title: activeTitle ?? fallbackTitle(genre),
				messages,
				memory,
				segments,
				currentTarget: null,
				phase: "loading",
				backgroundIntro: backgroundIntro ?? undefined,
				backgroundImage,
			}),
		);

		try {
			const {
				text,
				messages: updated,
				memory: updatedMemory,
			} = await autoContinueStoryStream(
				messages,
				(chunk) => setStreamingTarget((current) => current + chunk),
				model,
				memory,
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
					segments,
					currentTarget: text,
					phase: "typing",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
				}),
				{ generateTitle: activeTitle === fallbackTitle(genre) },
			);
			void refreshStoryBackground(genre, activeSaveId, updated);
		} catch (err) {
			setError(describeError(err));
			setStreamingTarget("");
		}
	}, [
		activeSaveId,
		activeTitle,
		backgroundIntro,
		genre,
		memory,
		messages,
		model,
		persistStory,
		refreshStoryBackground,
		backgroundImage,
		segments,
	]);

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
		resumeStory,
		segments,
		selectGenre,
		streamingTarget,
		submitContinuation,
	};
}
