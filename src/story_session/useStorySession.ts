import { useCallback, useEffect, useRef, useState } from "react";
import {
	autoContinueStoryStream,
	type ChatMessage,
	continueStoryStream,
	generateOpeningAudio,
	generateReadingStoryFrame,
	generateReadingStoryPartStream,
	generateStoryBackgroundImage,
	generateStoryIntro,
	type ReadingStoryFrame,
	regenerateWordTranslation,
	type StoryMemory,
	startStory,
	translateWords,
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

type View =
	| "menu"
	| "lessons-menu"
	| "esperanto-intro"
	| "lesson"
	| "word-match"
	| "lesson-typing"
	| "keyboard-intro"
	| "keyboard-words"
	| "keyboard-word-match"
	| "garden-lesson"
	| "garden-word-match"
	| "garden-phrase-builder"
	| "garden-typing"
	| "story";

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

function readingBackgroundMessages(
	selected: Genre,
	storyMessages: ChatMessage[],
): ChatMessage[] {
	return [
		{ role: "system", content: selected.systemPrompt },
		...storyMessages.filter((message) => message.role === "assistant"),
	];
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
	const [wordTranslations, setWordTranslations] = useState<Record<
		string,
		string
	> | null>(null);
	const [readingFrame, setReadingFrame] = useState<ReadingStoryFrame | null>(
		null,
	);
	const [readingPartIndex, setReadingPartIndex] = useState<number | null>(null);
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
	const readingFrameRef = useRef<ReadingStoryFrame | null>(null);
	const readingPartIndexRef = useRef<number | null>(null);
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
		readingFrameRef.current = readingFrame;
	}, [readingFrame]);

	useEffect(() => {
		readingPartIndexRef.current = readingPartIndex;
	}, [readingPartIndex]);

	useEffect(() => {
		narrationVoiceRef.current = narrationVoice;
	}, [narrationVoice]);

	useEffect(() => {
		if (phase !== "reading" || !currentTarget) {
			setWordTranslations(null);
			return;
		}
		const wordPattern = /[a-zA-ZĉĝĥĵŝŭĈĜĤĴŜŬ]+/g;
		const words = [
			...new Set(
				(currentTarget.match(wordPattern) ?? []).map((w) => w.toLowerCase()),
			),
		];
		if (words.length === 0) return;
		let cancelled = false;
		translateWords(words)
			.then((translations) => {
				if (!cancelled) setWordTranslations(translations);
			})
			.catch((err) => {
				console.warn("Could not translate words.", err);
			});
		return () => {
			cancelled = true;
		};
	}, [phase, currentTarget]);

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
						readingFrame: readingFrameRef.current ?? undefined,
						readingPartIndex: readingPartIndexRef.current ?? undefined,
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
			setReadingFrame(null);
			setReadingPartIndex(null);
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

	const startReadingStory = useCallback(async () => {
		const selected = genres.find((g) => g.id === "esperanto") ?? genres[0];
		const title = fallbackTitle(selected);
		const saveId = createSaveId();
		const nextNarrationVoice = pickRandomNarrationVoice();

		setGenre(selected);
		setMessages([]);
		setMemory(undefined);
		setSegments([]);
		setCurrentTarget(null);
		setStreamingTarget("");
		setError(null);
		setOpeningAudio(null);
		setReadingFrame(null);
		setReadingPartIndex(1);
		setPhase("loading");
		onViewChange("story");
		try {
			narrationVoiceRef.current = nextNarrationVoice;
			activeSaveIdRef.current = saveId;
			setActiveSaveId(saveId);
			setActiveTitle(title);
			setNarrationVoice(nextNarrationVoice);

			const frame = await generateReadingStoryFrame(selected, model);
			const { text } = await generateReadingStoryPartStream(
				frame,
				1,
				[],
				(chunk) => setStreamingTarget((current) => current + chunk),
				model,
			);
			const seeded: ChatMessage[] = [
				{ role: "system", content: selected.systemPrompt },
				{
					role: "user",
					content: `Six-part beginner reading story frame:\n${JSON.stringify(
						frame,
						null,
						2,
					)}`,
				},
				{ role: "assistant", content: text },
			];
			const nextOpeningAudio = await generateOpeningAudio(
				text,
				saveId,
				nextNarrationVoice,
			).catch((err) => {
				console.warn("Could not generate opening audio.", err);
				return null;
			});
			const nextBackgroundImage = fallbackBackgroundImage(selected);
			setMessages(seeded);
			setMemory(undefined);
			setCurrentTarget(text);
			setStreamingTarget("");
			setBackgroundIntro(null);
			setBackgroundImage(nextBackgroundImage);
			setOpeningAudio(nextOpeningAudio);
			setReadingFrame(frame);
			setReadingPartIndex(1);
			setPhase("reading");
			void persistStory(
				buildStorySaveSnapshot({
					id: saveId,
					genre: selected,
					title,
					messages: seeded,
					memory: undefined,
					segments: [],
					currentTarget: text,
					phase: "reading",
					backgroundImage: nextBackgroundImage,
					openingAudio: nextOpeningAudio,
					readingFrame: frame,
					readingPartIndex: 1,
					narrationVoice: nextNarrationVoice,
				}),
				{ generateTitle: true },
			);
			void generateAndApplyStoryBackground(
				selected,
				saveId,
				readingBackgroundMessages(selected, seeded),
			);
		} catch (err) {
			setError(describeError(err));
		}
	}, [generateAndApplyStoryBackground, model, onViewChange, persistStory]);

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
			setReadingFrame(null);
			setReadingPartIndex(null);
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
			void generateAndApplyStoryBackground(selected, saveId, seeded);
		},
		[generateAndApplyStoryBackground, onViewChange, persistStory],
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

	const continueReadingStory = useCallback(async () => {
		if (
			!genre ||
			!activeSaveId ||
			!readingFrame ||
			readingPartIndex === null ||
			currentTarget === null
		) {
			return;
		}

		const nextSegments: StorySegment[] = [
			...segments,
			{ id: segments.length, author: "ai", text: currentTarget },
		];
		const totalParts = readingFrame.totalParts;

		setSegments(nextSegments);
		setCurrentTarget(null);
		setStreamingTarget("");
		setOpeningAudio(null);
		setError(null);

		if (readingPartIndex >= totalParts) {
			setPhase("reading");
			void persistStory(
				buildStorySaveSnapshot({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages,
					memory,
					segments: nextSegments,
					currentTarget: null,
					phase: "reading",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio: null,
					readingFrame,
					readingPartIndex,
					narrationVoice,
				}),
			);
			return;
		}

		const nextPartIndex = readingPartIndex + 1;
		const loadingMessages: ChatMessage[] = [
			...messages,
			{
				role: "user",
				content: `Continue the six-part reading story with part ${nextPartIndex} of ${totalParts}.`,
			},
		];
		setMessages(loadingMessages);
		setPhase("loading");
		void persistStory(
			buildStorySaveSnapshot({
				id: activeSaveId,
				genre,
				title: activeTitle ?? fallbackTitle(genre),
				messages: loadingMessages,
				memory,
				segments: nextSegments,
				currentTarget: null,
				phase: "loading",
				backgroundIntro: backgroundIntro ?? undefined,
				backgroundImage,
				openingAudio: null,
				readingFrame,
				readingPartIndex: nextPartIndex,
				narrationVoice,
			}),
		);

		try {
			const { text } = await generateReadingStoryPartStream(
				readingFrame,
				nextPartIndex,
				nextSegments
					.filter((segment) => segment.author === "ai")
					.map((segment) => segment.text),
				(chunk) => setStreamingTarget((current) => current + chunk),
				model,
			);
			const updatedMessages: ChatMessage[] = [
				...loadingMessages,
				{ role: "assistant", content: text },
			];
			const nextOpeningAudio = await generateOpeningAudio(
				text,
				activeSaveId,
				narrationVoice,
			).catch((err) => {
				console.warn("Could not generate opening audio.", err);
				return null;
			});

			setMessages(updatedMessages);
			setCurrentTarget(text);
			setStreamingTarget("");
			setOpeningAudio(nextOpeningAudio);
			setReadingPartIndex(nextPartIndex);
			setPhase("reading");
			void persistStory(
				buildStorySaveSnapshot({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages: updatedMessages,
					memory,
					segments: nextSegments,
					currentTarget: text,
					phase: "reading",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio: nextOpeningAudio,
					readingFrame,
					readingPartIndex: nextPartIndex,
					narrationVoice,
				}),
				{ generateTitle: activeTitle === fallbackTitle(genre) },
			);
			void refreshStoryBackground(
				genre,
				activeSaveId,
				readingBackgroundMessages(genre, updatedMessages),
			);
		} catch (err) {
			setError(describeError(err));
			setStreamingTarget("");
			setPhase("reading");
		}
	}, [
		activeSaveId,
		activeTitle,
		backgroundImage,
		backgroundIntro,
		currentTarget,
		genre,
		memory,
		messages,
		model,
		narrationVoice,
		persistStory,
		readingFrame,
		readingPartIndex,
		refreshStoryBackground,
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
					openingAudio,
					readingFrame: readingFrame ?? undefined,
					readingPartIndex: readingPartIndex ?? undefined,
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
		setReadingFrame(null);
		setReadingPartIndex(null);
		setNarrationVoice(DEFAULT_NARRATION_VOICE);
		narrationVoiceRef.current = DEFAULT_NARRATION_VOICE;
		activeSaveIdRef.current = null;
		setActiveSaveId(null);
		setActiveTitle(null);
		setWordTranslations(null);
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
		readingFrame,
		readingPartIndex,
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
				setReadingFrame(save.readingFrame ?? null);
				setReadingPartIndex(save.readingPartIndex ?? null);
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

	const handleRegenerateWord = useCallback(
		async (word: string): Promise<string | null> => {
			try {
				const translation = await regenerateWordTranslation(word);
				if (translation !== null) {
					setWordTranslations((prev) =>
						prev ? { ...prev, [word]: translation } : { [word]: translation },
					);
				}
				return translation;
			} catch (err) {
				console.warn("Could not regenerate word translation.", err);
				return null;
			}
		},
		[],
	);

	return {
		activeSaveId,
		autoContinueStory,
		backToMenu,
		backgroundImage,
		backgroundIntro,
		continueReadingStory,
		currentTarget,
		error,
		genre,
		handleTypingComplete,
		phase,
		startReadingStory,
		openingAudio:
			currentTarget &&
			openingAudio?.openingAudioText === currentTarget &&
			(!openingAudio.openingAudioVoice ||
				openingAudio.openingAudioVoice === narrationVoice)
				? openingAudio
				: null,
		narrationVoice,
		regenerateWordTranslation: handleRegenerateWord,
		resumeStory,
		readingPartIndex,
		readingTotalParts: readingFrame?.totalParts ?? null,
		segments,
		selectGenre,
		startLessonStory,
		streamingTarget,
		submitContinuation,
		wordTranslations,
	};
}
