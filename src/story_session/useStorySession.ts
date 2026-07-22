import { useCallback, useEffect, useRef, useState } from "react";
import {
	autoContinueStoryStream,
	type ChatMessage,
	continueStoryStream,
	generateOpeningAudio,
	generateStoryBackgroundImage,
	generateStoryIntro,
	generateStoryRecapLesson,
	type ReadingStory,
	regenerateWordTranslation,
	type StoryMemory,
	startStory,
	titleStory,
} from "../ai";
import type {
	StoryPhase,
	StorySegment,
	TypingStats,
} from "../exercise_screen/types";
import { listStoryImages } from "../gallery/galleryApi";
import { type Genre, genres } from "../genres";
import { readSelectedNarrationModel } from "../modelSelection/modelSelectionStore";
import type { StoryGenerationPreset } from "../models";
import {
	DEFAULT_NARRATION_VOICE,
	isNarrationVoiceId,
	type NarrationVoiceId,
	pickRandomNarrationVoice,
} from "../narrationVoice";
import {
	consumePreparedOpening,
	consumePreparedReadingOpening,
	prepareMissingOpenings,
} from "../openings";
import { loadSavedStory } from "../saves";
import {
	readingImagePrompt,
	readingStoryMessages,
	readingStorySummary,
	readingVisualContext,
} from "../story";
import {
	isStoryOpeningAudioForText,
	type StoryOpeningAudio,
} from "../storyAudio";
import type { StoryBackgroundImage } from "../storyBackground";
import type { StoryRecapExerciseResult, StoryRecapLesson } from "../storyRecap";
import {
	backgroundFromOpening,
	buildSectionImageMap,
	fallbackBackgroundImage,
	shouldGenerateNextBackground,
} from "./background";
import { useStoryPersistence } from "./persistence/useStoryPersistence";
import {
	createReadingMedia,
	type ReadingMediaSection,
	type ReadingSectionMedia,
} from "./readingMedia";
import {
	buildStorySaveSnapshot,
	createSaveId,
	fallbackTitle,
} from "./storySnapshot";
import { useReadingPreparation } from "./useReadingPreparation";

// The session only distinguishes "am I on the main menu" from "in a story" from
// "somewhere in the lesson flow" — it never branches on individual lesson views.
type View = "menu" | "story" | "lesson";

interface UseStorySessionOptions {
	storyGeneration: StoryGenerationPreset;
	view: View;
	/** The unfinished reading-story save, if any — see `findUnfinishedReadingSave`. */
	unfinishedReadingSaveId: string | null;
	onViewChange: (view: View) => void;
	onSavedStoriesChanged: () => Promise<void>;
	onSavesError: (error: string | null) => void;
}

function describeError(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	if (
		/api key is not configured|environment variable is missing or empty/i.test(
			message,
		)
	) {
		return "AI setup is missing. Add the API key for the selected model to .env.local, then restart the dev server.";
	}
	return `Something went wrong reaching the AI: ${message}`;
}

/** Carries the section's dominant-action image prompt to the background-image endpoint. */
function readingBackgroundMessages(
	selected: Genre,
	imagePrompt: string,
): ChatMessage[] {
	return [
		{ role: "system", content: selected.systemPrompt },
		{ role: "assistant", content: imagePrompt },
	];
}

/** Everything the media owner needs to produce one section's narration and image. */
function readingMediaSection(
	selected: Genre,
	storyId: string,
	story: ReadingStory,
	partIndex: number,
	narrationVoice: NarrationVoiceId,
): ReadingMediaSection | null {
	const part = story.parts[partIndex - 1];
	if (!part) return null;
	return {
		storyId,
		partIndex,
		narrationVoice,
		text: part.text,
		imagePrompt: readingImagePrompt(story, partIndex),
		genre: selected,
		visualContext: readingVisualContext(story),
	};
}

function completedAiSegment(
	id: number,
	text: string,
	audio: StoryOpeningAudio | null,
): StorySegment {
	return {
		id,
		author: "ai",
		text,
		narrationAudio: isStoryOpeningAudioForText(audio, text) ? audio : undefined,
	};
}

/** Keep buffered tutor questions bounded so the baseline evidence stays small. */
const MAX_BUFFERED_BOT_QUESTIONS = 20;
const MAX_BOT_QUESTION_CHARS = 300;

export function useStorySession({
	storyGeneration,
	view,
	unfinishedReadingSaveId,
	onViewChange,
	onSavedStoriesChanged,
	onSavesError,
}: UseStorySessionOptions) {
	const model = storyGeneration.model;
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
	const [openingAudioLoading, setOpeningAudioLoading] = useState(false);
	const [openingAudioError, setOpeningAudioError] = useState(false);
	const [openingAudioRetry, setOpeningAudioRetry] = useState(0);
	const [wordTranslations, setWordTranslations] = useState<Record<
		string,
		string
	> | null>(null);
	const [readingStory, setReadingStory] = useState<ReadingStory | null>(null);
	const [readingPartIndex, setReadingPartIndex] = useState<number | null>(null);
	const [narrationVoice, setNarrationVoice] = useState<NarrationVoiceId>(
		DEFAULT_NARRATION_VOICE,
	);
	const [storyRecapLesson, setStoryRecapLesson] =
		useState<StoryRecapLesson | null>(null);
	const [storyRecapError, setStoryRecapError] = useState<string | null>(null);
	const [storyFeedbackSubmittedAt, setStoryFeedbackSubmittedAt] = useState<
		string | null
	>(null);
	// The submittable feedback form renders only for a story just finished in this
	// live session; a reopened/reread finished save shows its prior rating
	// read-only. This is the boundary that stops a reread from re-resolving
	// feedback behind an already-bound chain hint.
	const [feedbackEditable, setFeedbackEditable] = useState(false);
	// The resolved feedback for the current story, kept reactive so a reread can
	// display it read-only.
	const [storyFeedback, setStoryFeedback] = useState<string | null>(null);
	const activeSaveIdRef = useRef<string | null>(null);
	const activeTitleRef = useRef<string | null>(null);
	const messagesRef = useRef<ChatMessage[]>([]);
	const memoryRef = useRef<StoryMemory | undefined>(undefined);
	const segmentsRef = useRef<StorySegment[]>([]);
	const currentTargetRef = useRef<string | null>(null);
	const phaseRef = useRef<StoryPhase>("loading");
	const openingAudioRef = useRef<StoryOpeningAudio | null>(null);
	const readingStoryRef = useRef<ReadingStory | null>(null);
	const readingPartIndexRef = useRef<number | null>(null);
	const narrationVoiceRef = useRef<NarrationVoiceId>(DEFAULT_NARRATION_VOICE);
	const storyRecapLessonRef = useRef<StoryRecapLesson | null>(null);
	const storyRecapResultsRef = useRef<StoryRecapExerciseResult[]>([]);
	const storyFeedbackRef = useRef<string | null>(null);
	const storyFeedbackSubmittedAtRef = useRef<string | null>(null);
	// The learner's one-shot theme request for the *next* story. Transient: it is
	// handed to the preparation lifecycle at finalize, never persisted in this
	// story's save and never folded into the durable learner profile.
	const storyNextThemeRef = useRef<string | null>(null);
	// The live feedback-form draft, mirrored here so leaving the completion screen
	// resolves whatever the learner had entered — clicking Submit is not required.
	const storyFeedbackDraftRef = useRef<string>("");
	const storyThemeDraftRef = useRef<string>("");
	// The learner's own words about what felt hard / what to practice next — the
	// most direct signal for the next objective. Transient, like the theme draft.
	const storyPracticeDraftRef = useRef<string>("");
	// Interactive continuity: the learner's tutor questions asked while reading are
	// buffered here (deduped, bounded) and folded once into the baseline at story
	// end — they stay out of the durable handout until the story finalizes.
	const botQuestionsRef = useRef<string[]>([]);
	const preparingOpeningsRef = useRef(false);
	const prepareOpeningsAgainRef = useRef(false);
	// Distinguishes a story that reached "finished" just now, in this session,
	// from one loaded already finished (rereading an old save). Only the former
	// should ever finalize: rereading must not re-finalize or re-trigger
	// preparation against stale, superseded evidence.
	const justFinishedReadingRef = useRef(false);

	// Owns finalize-then-prepare for the next reading story, and the menu's
	// readiness for it.
	const readingPreparation = useReadingPreparation(
		storyGeneration,
		unfinishedReadingSaveId,
		view === "menu",
	);
	const {
		makeNextStory: makeNextReadingStory,
		retry: retryReadingPreparationLifecycle,
		markConsumed: markReadingStoryConsumed,
	} = readingPreparation;

	// The one owner of every reading narration and background image: preparing a
	// section ahead, arriving at it, and recovering it after a reload all ask the
	// same owner, so a section is never generated twice.
	const readingMediaRef = useRef(
		createReadingMedia({
			generateAudio: (section) =>
				generateOpeningAudio(
					section.text,
					section.storyId,
					section.narrationVoice,
					{
						sectionIndex: section.partIndex,
						ttsModel: readSelectedNarrationModel(),
					},
				),
			generateBackground: async (section) => {
				const image = await generateStoryBackgroundImage(
					section.genre.id,
					readingBackgroundMessages(section.genre, section.imagePrompt),
					section.storyId,
					{
						sectionIndex: section.partIndex,
						visualContext: section.visualContext,
					},
				);
				// A fallback image is the genre's stock picture, not this section's:
				// leave the previous background in place rather than swapping to it.
				return image.backgroundImageSource === "generated" ? image : null;
			},
		}),
	);

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
		readingStoryRef.current = readingStory;
	}, [readingStory]);

	const wordTranslationsRef = useRef<Record<string, string> | null>(null);
	useEffect(() => {
		wordTranslationsRef.current = wordTranslations;
	}, [wordTranslations]);

	useEffect(() => {
		readingPartIndexRef.current = readingPartIndex;
	}, [readingPartIndex]);

	useEffect(() => {
		narrationVoiceRef.current = narrationVoice;
	}, [narrationVoice]);

	useEffect(() => {
		storyRecapLessonRef.current = storyRecapLesson;
	}, [storyRecapLesson]);

	useEffect(() => {
		storyFeedbackSubmittedAtRef.current = storyFeedbackSubmittedAt;
	}, [storyFeedbackSubmittedAt]);

	const makeStorySaveSnapshot = useRef(
		(input: Parameters<typeof buildStorySaveSnapshot>[0]) =>
			buildStorySaveSnapshot({
				...input,
				wordTranslations: wordTranslationsRef.current ?? undefined,
				storyRecapResults: storyRecapResultsRef.current,
				storyLearnerQuestions: botQuestionsRef.current,
				storyFeedback: storyFeedbackRef.current ?? undefined,
				storyFeedbackSubmittedAt:
					storyFeedbackSubmittedAtRef.current ?? undefined,
			}),
	);

	// The whole-story gloss map is seeded when a reading story starts (from the
	// prepared opening) or resumes (from the save). It follows the reading story:
	// clear it whenever there is no reading story, which covers every path back to
	// a typing story or the menu without touching each reset site.
	useEffect(() => {
		if (!readingStory) setWordTranslations(null);
	}, [readingStory]);

	const persistStory = useStoryPersistence({
		model,
		activeSaveIdRef,
		onSavedStoriesChanged,
		onSavesError,
		onTitleGenerated: setActiveTitle,
	});

	// Narration the learner is looking at but does not have — a reload mid-story,
	// a section whose audio failed earlier. The media owner hands back the
	// request already running for this section rather than starting another.
	useEffect(() => {
		void openingAudioRetry;
		if (
			phase !== "reading" ||
			!genre ||
			!activeSaveId ||
			!currentTarget ||
			!readingStory ||
			readingPartIndex === null
		) {
			return;
		}
		if (
			openingAudio?.openingAudioText === currentTarget &&
			openingAudio.openingAudioVoice === narrationVoice
		) {
			setOpeningAudioLoading(false);
			setOpeningAudioError(false);
			return;
		}

		const section = readingMediaSection(
			genre,
			activeSaveId,
			readingStory,
			readingPartIndex,
			narrationVoice,
		);
		if (!section || section.text !== currentTarget) return;

		let cancelled = false;
		setOpeningAudioLoading(true);
		setOpeningAudioError(false);
		void readingMediaRef.current
			.requestAudio(section)
			.then((nextOpeningAudio) => {
				if (
					cancelled ||
					activeSaveIdRef.current !== activeSaveId ||
					currentTargetRef.current !== currentTarget ||
					readingPartIndexRef.current !== readingPartIndex
				) {
					return;
				}
				setOpeningAudioLoading(false);
				if (!nextOpeningAudio) {
					setOpeningAudioError(true);
					return;
				}

				setOpeningAudio(nextOpeningAudio);
				void persistStory(
					makeStorySaveSnapshot.current({
						id: activeSaveId,
						genre,
						title: activeTitleRef.current ?? fallbackTitle(genre),
						messages: messagesRef.current,
						memory: memoryRef.current,
						segments: segmentsRef.current,
						currentTarget,
						phase: phaseRef.current,
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage: backgroundImage,
						openingAudio: nextOpeningAudio,
						readingStory,
						readingPartIndex,
						narrationVoice,
					}),
				);
			});

		return () => {
			cancelled = true;
		};
	}, [
		activeSaveId,
		backgroundImage,
		backgroundIntro,
		currentTarget,
		genre,
		narrationVoice,
		openingAudio,
		persistStory,
		phase,
		readingPartIndex,
		readingStory,
		openingAudioRetry,
	]);

	const generateAndApplyStoryBackground = useCallback(
		async (
			selected: Genre,
			saveId: string,
			storyMessages: ChatMessage[],
			sectionIndex?: number,
			visualContext?: string,
		) => {
			try {
				const nextBackgroundImage = await generateStoryBackgroundImage(
					selected.id,
					storyMessages,
					saveId,
					{ sectionIndex, visualContext },
				);
				if (
					activeSaveIdRef.current !== saveId ||
					nextBackgroundImage.backgroundImageSource !== "generated"
				) {
					return;
				}

				setBackgroundImage(nextBackgroundImage);
				void persistStory(
					makeStorySaveSnapshot.current({
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
						readingStory: readingStoryRef.current ?? undefined,
						readingPartIndex: readingPartIndexRef.current ?? undefined,
						narrationVoice: narrationVoiceRef.current,
						storyRecapLesson: storyRecapLessonRef.current,
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

	/** Shows a reading section's background as soon as the media owner has it. */
	const applyReadingBackground = useCallback(
		async (section: ReadingMediaSection) => {
			const image = await readingMediaRef.current.requestBackground(section);
			if (!image || activeSaveIdRef.current !== section.storyId) return;

			setBackgroundImage(image);
			void persistStory(
				makeStorySaveSnapshot.current({
					id: section.storyId,
					genre: section.genre,
					title: activeTitleRef.current ?? fallbackTitle(section.genre),
					messages: messagesRef.current,
					memory: memoryRef.current,
					segments: segmentsRef.current,
					currentTarget: currentTargetRef.current,
					phase: phaseRef.current,
					backgroundImage: image,
					openingAudio: openingAudioRef.current,
					readingStory: readingStoryRef.current ?? undefined,
					readingPartIndex: readingPartIndexRef.current ?? undefined,
					narrationVoice: narrationVoiceRef.current,
					storyRecapLesson: storyRecapLessonRef.current,
				}),
			);
		},
		[persistStory],
	);

	/**
	 * Hands the media owner everything a story already has: narration recorded on
	 * the segments the learner has read, and the images the story has generated
	 * across its sessions. Sections covered by this are never generated again.
	 */
	const seedReadingMediaFromHistory = useCallback(
		({
			selected,
			saveId,
			story,
			voice,
			segments: history,
			imageMap,
		}: {
			selected: Genre;
			saveId: string;
			story: ReadingStory;
			voice: NarrationVoiceId;
			segments: StorySegment[];
			imageMap: Record<number, StoryBackgroundImage>;
		}) => {
			story.parts.forEach((_part, index) => {
				const partIndex = index + 1;
				const section = readingMediaSection(
					selected,
					saveId,
					story,
					partIndex,
					voice,
				);
				if (!section) return;

				const media: Partial<ReadingSectionMedia> = {};
				const audio = history[index]?.narrationAudio ?? null;
				if (isStoryOpeningAudioForText(audio, section.text, voice)) {
					media.openingAudio = audio;
				}
				const image = imageMap[partIndex];
				if (image) media.backgroundImage = image;
				readingMediaRef.current.seed(section, media);
			});
		},
		[],
	);

	/** Warms the next section's media while the learner reads the current one. */
	const prepareNextReadingSection = useCallback(
		(
			selected: Genre,
			saveId: string,
			story: ReadingStory,
			currentPartIndex: number,
		) => {
			const section = readingMediaSection(
				selected,
				saveId,
				story,
				currentPartIndex + 1,
				narrationVoiceRef.current,
			);
			if (!section) return;
			void readingMediaRef.current.prepare(section);
		},
		[],
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

	// Typing openings are cheap to hold and are prefetched on menu entry. Reading
	// stories are not: each one is prepared by `useReadingPreparation` as the
	// consequence of finishing the previous story, so that it sees that story's
	// evidence. Opening the menu must not start one.
	useEffect(() => {
		if (view === "menu") {
			void prepareOpeningsInBackground();
		}
	}, [view, prepareOpeningsInBackground]);

	const selectGenre = useCallback(
		async (selected: Genre) => {
			readingMediaRef.current.reset();
			justFinishedReadingRef.current = false;
			storyFeedbackSubmittedAtRef.current = null;
			botQuestionsRef.current = [];
			storyFeedbackRef.current = null;
			storyNextThemeRef.current = null;
			storyRecapResultsRef.current = [];
			setStoryFeedbackSubmittedAt(null);
			setGenre(selected);
			setMessages([]);
			setMemory(undefined);
			setSegments([]);
			setCurrentTarget(null);
			setStreamingTarget("");
			setError(null);
			setOpeningAudio(null);
			setReadingStory(null);
			setReadingPartIndex(null);
			setStoryRecapLesson(null);
			storyRecapLessonRef.current = null;
			setStoryRecapError(null);
			setPhase("loading");
			onViewChange("story");
			try {
				let opening: {
					id?: string;
					title?: string;
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

				const { text, messages: seeded } = opening;
				const title = opening.title?.trim()
					? opening.title
					: await titleStory(seeded, model).catch(() =>
							fallbackTitle(selected),
						);
				const usePreparedBundle = Boolean(opening.id && opening.title);
				const saveId =
					usePreparedBundle && opening.id ? opening.id : createSaveId(title);
				const nextNarrationVoice = isNarrationVoiceId(opening.narrationVoice)
					? opening.narrationVoice
					: pickRandomNarrationVoice();
				narrationVoiceRef.current = nextNarrationVoice;
				activeSaveIdRef.current = saveId;
				setActiveSaveId(saveId);
				setActiveTitle(title);
				setNarrationVoice(nextNarrationVoice);

				const intro =
					opening.backgroundIntro ||
					(await generateStoryIntro(selected.label, text, model).catch(
						() => "",
					));
				const nextOpeningAudio =
					usePreparedBundle &&
					opening.openingAudioUrl &&
					opening.openingAudioSource === "generated" &&
					opening.openingAudioVoice === nextNarrationVoice
						? {
								openingAudioUrl: opening.openingAudioUrl,
								openingAudioSource: opening.openingAudioSource,
								openingAudioText: opening.openingAudioText ?? text,
								openingAudioVoice: opening.openingAudioVoice,
							}
						: await generateOpeningAudio(text, saveId, nextNarrationVoice, {
								sectionIndex: 1,
								ttsModel: readSelectedNarrationModel(),
							}).catch((err) => {
								console.warn("Could not generate opening audio.", err);
								return null;
							});
				const nextBackgroundImage = usePreparedBundle
					? backgroundFromOpening(opening, selected)
					: fallbackBackgroundImage(selected);
				setMessages(seeded);
				setMemory(undefined);
				setCurrentTarget(text);
				setStreamingTarget("");
				setBackgroundIntro(intro);
				setBackgroundImage(nextBackgroundImage);
				setOpeningAudio(nextOpeningAudio);
				setPhase("typing");
				void persistStory(
					makeStorySaveSnapshot.current({
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
				);
				if (!consumedPreparedOpening || !usePreparedBundle) {
					void generateAndApplyStoryBackground(selected, saveId, seeded, 1);
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

		let preparedOpening: Awaited<
			ReturnType<typeof consumePreparedReadingOpening>
		> = null;
		try {
			preparedOpening = await consumePreparedReadingOpening(selected.id);
		} catch (err) {
			console.warn("Could not consume a prepared reading opening.", err);
		}
		if (!preparedOpening) {
			// Nothing was consumed, so there is no queued story to start and
			// nothing for the lifecycle to fold in. Generating one here would
			// bypass the lifecycle that keeps prepared stories in sync with
			// finalized evidence, so refuse instead and leave the menu in place
			// for preparation (or a retry of it) to fill the queue.
			retryReadingPreparationLifecycle();
			return;
		}
		// The queue is empty from here until this story is finished and
		// finalized; nothing prepares a replacement in the meantime.
		markReadingStoryConsumed();

		readingMediaRef.current.reset();
		justFinishedReadingRef.current = false;
		storyFeedbackSubmittedAtRef.current = null;
		botQuestionsRef.current = [];
		storyFeedbackRef.current = null;
		storyNextThemeRef.current = null;
		storyRecapResultsRef.current = [];
		setStoryFeedbackSubmittedAt(null);
		setGenre(selected);
		setMessages([]);
		setMemory(undefined);
		setSegments([]);
		setCurrentTarget(null);
		setStreamingTarget("");
		setError(null);
		setOpeningAudio(null);
		setReadingStory(null);
		setReadingPartIndex(1);
		setStoryRecapLesson(null);
		storyRecapLessonRef.current = null;
		setStoryRecapError(null);
		setPhase("loading");
		onViewChange("story");
		try {
			const nextNarrationVoice = isNarrationVoiceId(
				preparedOpening.narrationVoice,
			)
				? preparedOpening.narrationVoice
				: pickRandomNarrationVoice();
			narrationVoiceRef.current = nextNarrationVoice;
			setNarrationVoice(nextNarrationVoice);

			const story = preparedOpening.readingStory;
			const firstPart = story.parts[0];
			if (!firstPart) throw new Error("The reading story has no parts.");

			const text = firstPart.text;
			const title = story.title.trim() || fallbackTitle(selected);
			const saveId = preparedOpening.id;
			activeSaveIdRef.current = saveId;
			setActiveSaveId(saveId);
			setActiveTitle(title);

			const seeded = readingStoryMessages(selected, story, 1);
			const firstSection = readingMediaSection(
				selected,
				saveId,
				story,
				1,
				nextNarrationVoice,
			);
			if (!firstSection) throw new Error("The reading story has no parts.");

			// Part 1's media was prepared with the queued story: hand it to the media
			// owner so nothing regenerates what we already have.
			if (
				preparedOpening.openingAudioUrl &&
				preparedOpening.openingAudioSource === "generated" &&
				preparedOpening.openingAudioVoice === nextNarrationVoice
			) {
				readingMediaRef.current.seed(firstSection, {
					openingAudio: {
						openingAudioUrl: preparedOpening.openingAudioUrl,
						openingAudioSource: preparedOpening.openingAudioSource,
						openingAudioText: preparedOpening.openingAudioText ?? text,
						openingAudioVoice: preparedOpening.openingAudioVoice,
					},
				});
			}
			if (preparedOpening.backgroundImageSource === "generated") {
				readingMediaRef.current.seed(firstSection, {
					backgroundImage: backgroundFromOpening(preparedOpening, selected),
				});
			}

			const nextBackgroundImage = backgroundFromOpening(
				preparedOpening,
				selected,
			);
			const nextOpeningAudio =
				await readingMediaRef.current.requestAudio(firstSection);
			setMessages(seeded);
			setMemory(undefined);
			setCurrentTarget(text);
			setStreamingTarget("");
			setBackgroundIntro(null);
			setBackgroundImage(nextBackgroundImage);
			setOpeningAudio(nextOpeningAudio);
			setReadingStory(story);
			readingStoryRef.current = story;
			wordTranslationsRef.current = preparedOpening.wordTranslations ?? {};
			setWordTranslations(preparedOpening.wordTranslations ?? {});
			setReadingPartIndex(1);
			setPhase("reading");
			void persistStory(
				makeStorySaveSnapshot.current({
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
					readingStory: story,
					readingPartIndex: 1,
					narrationVoice: nextNarrationVoice,
				}),
			);
			void applyReadingBackground(firstSection);
			prepareNextReadingSection(selected, saveId, story, 1);
		} catch (err) {
			setPhase("error");
			setError(describeError(err));
		}
	}, [
		applyReadingBackground,
		markReadingStoryConsumed,
		onViewChange,
		persistStory,
		prepareNextReadingSection,
		retryReadingPreparationLifecycle,
	]);

	const startLessonStory = useCallback(
		({ title, storyText }: { title: string; storyText: string }) => {
			const selected =
				genres.find((candidate) => candidate.id === "esperanto") ?? genres[0];
			const saveId = createSaveId(title);
			const nextNarrationVoice = pickRandomNarrationVoice();
			// Seed the history as if the AI had opened with the lesson sentence, so
			// the existing continuation flow works once the learner types it.
			const seeded: ChatMessage[] = [
				{ role: "system", content: selected.systemPrompt },
				{ role: "user", content: "Begin the story." },
				{ role: "assistant", content: storyText },
			];
			const nextBackgroundImage = fallbackBackgroundImage(selected);

			readingMediaRef.current.reset();
			justFinishedReadingRef.current = false;
			storyFeedbackSubmittedAtRef.current = null;
			botQuestionsRef.current = [];
			storyFeedbackRef.current = null;
			storyNextThemeRef.current = null;
			storyRecapResultsRef.current = [];
			setStoryFeedbackSubmittedAt(null);
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
			setReadingStory(null);
			setReadingPartIndex(null);
			setStoryRecapLesson(null);
			storyRecapLessonRef.current = null;
			setStoryRecapError(null);
			setError(null);
			setPhase("typing");
			onViewChange("story");
			void persistStory(
				makeStorySaveSnapshot.current({
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
			void generateAndApplyStoryBackground(selected, saveId, seeded, 1);
		},
		[generateAndApplyStoryBackground, onViewChange, persistStory],
	);

	const handleTypingComplete = useCallback(
		(_stats: TypingStats) => {
			if (currentTarget === null) return;
			const nextSegments: StorySegment[] = [
				...segments,
				completedAiSegment(segments.length, currentTarget, openingAudio),
			];
			setSegments(nextSegments);
			setCurrentTarget(null);
			setStreamingTarget("");
			setPhase("authoring");
			if (genre && activeSaveId) {
				void persistStory(
					makeStorySaveSnapshot.current({
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
				makeStorySaveSnapshot.current({
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
					makeStorySaveSnapshot.current({
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
				setPhase("error");
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

	const generateAndApplyStoryRecap = useCallback(
		async (finishedSegments: StorySegment[]) => {
			if (!genre || !activeSaveId || !readingStory) return;

			setStoryRecapError(null);
			setPhase("recap-loading");

			try {
				const storyParts = finishedSegments
					.filter((segment) => segment.author === "ai")
					.map((segment) => segment.text);
				// Reuse the contextual glosses prepared with the story; they already
				// cover every story word, so the recap needs no fresh translation call.
				const translations = wordTranslationsRef.current ?? {};
				// The recap is a small structured exercise, not prose, so it does not
				// follow the story-generation preset (a prose-tier model + reasoning
				// effort chosen for the story itself). It uses EXERCISE_MODEL.
				const lesson = await generateStoryRecapLesson({
					storyParts,
					languageFocuses: [readingStory.languageFocus],
					wordTranslations: translations,
				});

				storyRecapLessonRef.current = lesson;
				setStoryRecapLesson(lesson);
				setStoryRecapError(null);
				setPhase("recap");
				void persistStory(
					makeStorySaveSnapshot.current({
						id: activeSaveId,
						genre,
						title: activeTitle ?? fallbackTitle(genre),
						messages,
						memory,
						segments: finishedSegments,
						currentTarget: null,
						phase: "recap",
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage,
						openingAudio: null,
						readingStory,
						readingPartIndex: readingPartIndex ?? readingStory.parts.length,
						narrationVoice,
						storyRecapLesson: lesson,
					}),
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setStoryRecapError(`Could not build the recap practice: ${message}`);
				setPhase("recap-loading");
				void persistStory(
					makeStorySaveSnapshot.current({
						id: activeSaveId,
						genre,
						title: activeTitle ?? fallbackTitle(genre),
						messages,
						memory,
						segments: finishedSegments,
						currentTarget: null,
						phase: "recap-loading",
						backgroundIntro: backgroundIntro ?? undefined,
						backgroundImage,
						openingAudio: null,
						readingStory,
						readingPartIndex: readingPartIndex ?? readingStory.parts.length,
						narrationVoice,
						storyRecapLesson: storyRecapLessonRef.current,
					}),
				);
			}
		},
		[
			activeSaveId,
			activeTitle,
			backgroundImage,
			backgroundIntro,
			genre,
			memory,
			messages,
			narrationVoice,
			persistStory,
			readingStory,
			readingPartIndex,
		],
	);

	/**
	 * Moves to the next section of the story that already exists. No text is
	 * generated here: the next part is `readingStory.parts[nextIndex - 1]`, and
	 * its narration was prepared while the learner read the current section.
	 */
	const continueReadingStory = useCallback(async () => {
		if (
			!genre ||
			!activeSaveId ||
			!readingStory ||
			readingPartIndex === null ||
			currentTarget === null
		) {
			return;
		}

		const currentSection = readingMediaSection(
			genre,
			activeSaveId,
			readingStory,
			readingPartIndex,
			narrationVoice,
		);
		if (!currentSection) return;

		const currentOpeningAudio = isStoryOpeningAudioForText(
			openingAudioRef.current,
			currentTarget,
			narrationVoice,
		)
			? openingAudioRef.current
			: null;

		if (
			activeSaveIdRef.current !== activeSaveId ||
			currentTargetRef.current !== currentTarget ||
			readingPartIndexRef.current !== readingPartIndex
		) {
			return;
		}
		const nextSegments: StorySegment[] = [
			...segments,
			completedAiSegment(segments.length, currentTarget, currentOpeningAudio),
		];
		const totalParts = readingStory.parts.length;
		setError(null);

		if (readingPartIndex >= totalParts) {
			setSegments(nextSegments);
			setCurrentTarget(null);
			setStreamingTarget("");
			setOpeningAudio(null);
			setStoryRecapLesson(null);
			storyRecapLessonRef.current = null;
			setStoryRecapError(null);
			setPhase("recap-loading");
			void persistStory(
				makeStorySaveSnapshot.current({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages,
					memory,
					segments: nextSegments,
					currentTarget: null,
					phase: "recap-loading",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio: null,
					readingStory,
					readingPartIndex,
					narrationVoice,
					storyRecapLesson: null,
				}),
			);
			void generateAndApplyStoryRecap(nextSegments);
			return;
		}

		const nextPartIndex = readingPartIndex + 1;
		const nextSection = readingMediaSection(
			genre,
			activeSaveId,
			readingStory,
			nextPartIndex,
			narrationVoice,
		);
		if (!nextSection) return;

		const text = nextSection.text;
		const updatedMessages = readingStoryMessages(
			genre,
			readingStory,
			nextPartIndex,
		);
		if (activeSaveIdRef.current !== activeSaveId) return;

		setSegments(nextSegments);
		setMessages(updatedMessages);
		setCurrentTarget(text);
		setStreamingTarget("");
		setOpeningAudio(null);
		setOpeningAudioLoading(true);
		setOpeningAudioError(false);
		setReadingPartIndex(nextPartIndex);
		setPhase("reading");
		void persistStory(
			makeStorySaveSnapshot.current({
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
				openingAudio: null,
				readingStory,
				readingPartIndex: nextPartIndex,
				narrationVoice,
			}),
		);

		// The background this section was prepared with, applied the moment it is
		// there; sections the cadence skips keep the previous image.
		void applyReadingBackground(nextSection);
		prepareNextReadingSection(genre, activeSaveId, readingStory, nextPartIndex);
	}, [
		activeSaveId,
		activeTitle,
		applyReadingBackground,
		backgroundImage,
		backgroundIntro,
		currentTarget,
		genre,
		memory,
		messages,
		narrationVoice,
		persistStory,
		prepareNextReadingSection,
		readingStory,
		readingPartIndex,
		generateAndApplyStoryRecap,
		segments,
	]);

	const retryOpeningAudio = useCallback(() => {
		setOpeningAudioError(false);
		setOpeningAudioLoading(true);
		setOpeningAudioRetry((value) => value + 1);
	}, []);

	const completeStoryRecap = useCallback(
		(results: StoryRecapExerciseResult[] = []) => {
			if (!genre || !activeSaveId) return;
			storyRecapResultsRef.current = results;
			justFinishedReadingRef.current = true;
			// A live finish: the feedback form is submittable, and its draft starts
			// empty so nothing from a previous story leaks into this resolution.
			storyFeedbackDraftRef.current = "";
			storyThemeDraftRef.current = "";
			storyPracticeDraftRef.current = "";
			setStoryFeedback(null);
			setFeedbackEditable(true);
			setPhase("finished");
			setStoryRecapError(null);
			void persistStory(
				makeStorySaveSnapshot.current({
					id: activeSaveId,
					genre,
					title: activeTitle ?? fallbackTitle(genre),
					messages,
					memory,
					segments,
					currentTarget: null,
					phase: "finished",
					backgroundIntro: backgroundIntro ?? undefined,
					backgroundImage,
					openingAudio: null,
					readingStory: readingStory ?? undefined,
					readingPartIndex: readingPartIndex ?? undefined,
					narrationVoice,
					storyRecapLesson,
				}),
			);
		},
		[
			activeSaveId,
			activeTitle,
			backgroundImage,
			backgroundIntro,
			genre,
			memory,
			messages,
			narrationVoice,
			persistStory,
			readingStory,
			readingPartIndex,
			segments,
			storyRecapLesson,
		],
	);

	const retryStoryRecap = useCallback(() => {
		void generateAndApplyStoryRecap(segments);
	}, [generateAndApplyStoryRecap, segments]);

	const skipStoryRecap = useCallback(() => {
		completeStoryRecap();
	}, [completeStoryRecap]);

	/**
	 * Hands the finished reading story to the preparation lifecycle: its evidence
	 * is finalized, and only then is the next story prepared. The evidence is
	 * captured here rather than read when finalization runs, because the caller
	 * clears the session as it navigates away.
	 */
	const finalizeReadingEvidence = useCallback(
		(feedback?: string, nextTheme?: string, practiceRequest?: string) => {
			const story = readingStoryRef.current;
			const saveId = activeSaveIdRef.current;
			// `justFinishedReadingRef` is what makes this safe to call from both
			// `backToMenu` and `submitStoryFeedback` without double-finalizing —
			// and, more importantly, what stops rereading an already-finished save
			// from finalizing it again against evidence a later story has since
			// superseded.
			if (
				!story ||
				!saveId ||
				phaseRef.current !== "finished" ||
				!justFinishedReadingRef.current
			) {
				return;
			}
			justFinishedReadingRef.current = false;
			makeNextReadingStory(
				{
					storyId: saveId,
					storySummary: readingStorySummary(story),
					languageFocus: story.languageFocus,
					learnerQuestions: botQuestionsRef.current,
					recapResults: storyRecapResultsRef.current,
					...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
					...(practiceRequest?.trim()
						? { practiceRequest: practiceRequest.trim() }
						: {}),
				},
				nextTheme?.trim() || undefined,
			);
		},
		[makeNextReadingStory],
	);

	const backToMenu = useCallback(() => {
		if (readingStory && activeSaveId && phase === "finished") {
			// Leaving the completion screen resolves feedback from whatever is on the
			// form right now — Submit is not required. finalizeReadingEvidence is
			// guarded by justFinishedReadingRef, so a reread's leave is a no-op and
			// its stale draft is never consumed.
			const draftFeedback = storyFeedbackDraftRef.current.trim();
			const draftTheme = storyThemeDraftRef.current.trim();
			const resolvedFeedback =
				draftFeedback || storyFeedbackRef.current || undefined;
			const resolvedTheme =
				draftTheme || storyNextThemeRef.current || undefined;
			const resolvedPractice =
				storyPracticeDraftRef.current.trim() || undefined;
			if (resolvedFeedback) {
				storyFeedbackRef.current = resolvedFeedback;
				if (!storyFeedbackSubmittedAtRef.current) {
					storyFeedbackSubmittedAtRef.current = new Date().toISOString();
				}
			}
			finalizeReadingEvidence(
				resolvedFeedback,
				resolvedTheme,
				resolvedPractice,
			);
		}
		if (genre && activeSaveId) {
			void persistStory(
				makeStorySaveSnapshot.current({
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
					readingStory: readingStory ?? undefined,
					readingPartIndex: readingPartIndex ?? undefined,
					narrationVoice,
					storyRecapLesson: storyRecapLessonRef.current,
				}),
			);
		}
		readingMediaRef.current.reset();
		justFinishedReadingRef.current = false;
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
		setReadingStory(null);
		setReadingPartIndex(null);
		setStoryRecapLesson(null);
		storyRecapLessonRef.current = null;
		setStoryRecapError(null);
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
		readingStory,
		readingPartIndex,
		narrationVoice,
		segments,
		finalizeReadingEvidence,
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
				// A resumed save is never "just finished" in this session, even one
				// that was already finished when saved — rereading it must not
				// re-finalize it.
				justFinishedReadingRef.current = false;
				activeSaveIdRef.current = save.id;
				const readingTotalParts = save.readingStory?.parts.length;
				const restoredPhase: StoryPhase =
					save.phase === "reading" &&
					save.currentTarget === null &&
					readingTotalParts !== undefined &&
					save.segments.filter((segment) => segment.author === "ai").length >=
						readingTotalParts
						? save.storyRecapLesson
							? "recap"
							: "recap-loading"
						: save.phase === "recap-loading" && save.storyRecapLesson
							? "recap"
							: save.phase;
				const savedNarrationVoice = isNarrationVoiceId(save.narrationVoice)
					? save.narrationVoice
					: DEFAULT_NARRATION_VOICE;
				const savedBackgroundImage =
					save.backgroundImageUrl &&
					(save.backgroundImageSource === "generated" ||
						save.backgroundImageSource === "fallback")
						? {
								backgroundImageUrl: save.backgroundImageUrl,
								backgroundImagePrompt: save.backgroundImagePrompt,
								backgroundImageSource: save.backgroundImageSource,
							}
						: fallbackBackgroundImage(selected);
				const savedOpeningAudio =
					save.openingAudioUrl && save.openingAudioSource === "generated"
						? {
								openingAudioUrl: save.openingAudioUrl,
								openingAudioSource: save.openingAudioSource,
								openingAudioText:
									save.openingAudioText ?? save.currentTarget ?? "",
								openingAudioVoice: save.openingAudioVoice,
							}
						: null;

				setActiveSaveId(save.id);
				setActiveTitle(save.title);
				setGenre(selected);
				setMessages(save.messages);
				setMemory(save.memory);
				setSegments(save.segments);
				setCurrentTarget(save.currentTarget);
				setStreamingTarget("");
				setPhase(restoredPhase);
				setReadingStory(save.readingStory ?? null);
				readingStoryRef.current = save.readingStory ?? null;
				wordTranslationsRef.current = save.wordTranslations ?? null;
				setWordTranslations(save.wordTranslations ?? null);
				setReadingPartIndex(save.readingPartIndex ?? null);
				narrationVoiceRef.current = savedNarrationVoice;
				setNarrationVoice(savedNarrationVoice);
				setBackgroundIntro(save.backgroundIntro ?? null);
				setBackgroundImage(savedBackgroundImage);
				setOpeningAudio(savedOpeningAudio);
				storyRecapLessonRef.current = save.storyRecapLesson ?? null;
				setStoryRecapLesson(save.storyRecapLesson ?? null);
				storyRecapResultsRef.current = save.storyRecapResults ?? [];
				botQuestionsRef.current = save.storyLearnerQuestions ?? [];
				storyFeedbackRef.current = save.storyFeedback ?? null;
				storyFeedbackSubmittedAtRef.current =
					save.storyFeedbackSubmittedAt ?? null;
				setStoryFeedbackSubmittedAt(save.storyFeedbackSubmittedAt ?? null);
				// A reopened save is never a live finish: its feedback form is
				// read-only, showing only whatever rating was recorded before.
				setStoryFeedback(save.storyFeedback ?? null);
				setFeedbackEditable(false);
				storyFeedbackDraftRef.current = "";
				storyThemeDraftRef.current = "";
				storyPracticeDraftRef.current = "";
				setStoryRecapError(
					restoredPhase === "recap-loading"
						? "The recap practice needs to be generated again."
						: null,
				);
				setError(null);
				onViewChange("story");

				const story = save.readingStory;
				const partIndex = save.readingPartIndex;
				if (!story || !partIndex || restoredPhase !== "reading") return;

				// A resumed story keeps whatever media it has already generated: the
				// narration on its segments, the images in its gallery. Only what is
				// genuinely missing is prepared again.
				readingMediaRef.current.reset();
				const imageMap = await listStoryImages(save.id)
					.then(buildSectionImageMap)
					.catch((err) => {
						console.warn("Could not load story images for resume.", err);
						return {} as Record<number, StoryBackgroundImage>;
					});
				if (activeSaveIdRef.current !== save.id) return;

				seedReadingMediaFromHistory({
					selected,
					saveId: save.id,
					story,
					voice: savedNarrationVoice,
					segments: save.segments,
					imageMap,
				});
				const currentSection = readingMediaSection(
					selected,
					save.id,
					story,
					partIndex,
					savedNarrationVoice,
				);
				if (currentSection) {
					readingMediaRef.current.seed(currentSection, {
						...(isStoryOpeningAudioForText(
							savedOpeningAudio,
							currentSection.text,
							savedNarrationVoice,
						)
							? { openingAudio: savedOpeningAudio }
							: {}),
						...(savedBackgroundImage.backgroundImageSource === "generated"
							? { backgroundImage: savedBackgroundImage }
							: {}),
					});
				}
				prepareNextReadingSection(selected, save.id, story, partIndex);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				onSavesError(`Could not load story: ${message}`);
			}
		},
		[
			onSavesError,
			onViewChange,
			prepareNextReadingSection,
			seedReadingMediaFromHistory,
		],
	);

	// The live form reports its current contents here so leaving the completion
	// screen can resolve them without an explicit Submit.
	const handleStoryFeedbackDraftChange = useCallback(
		(feedback: string, nextStoryTheme: string, practiceRequest: string) => {
			storyFeedbackDraftRef.current = feedback;
			storyThemeDraftRef.current = nextStoryTheme;
			storyPracticeDraftRef.current = practiceRequest;
		},
		[],
	);

	const submitStoryFeedback = useCallback(
		(feedback: string, nextStoryTheme = "", practiceRequest = "") => {
			const submittedAt = new Date().toISOString();
			const cleanFeedback = feedback.trim();
			const cleanTheme = nextStoryTheme.trim();
			const cleanPractice = practiceRequest.trim();
			storyFeedbackRef.current = cleanFeedback;
			storyNextThemeRef.current = cleanTheme || null;
			storyFeedbackDraftRef.current = cleanFeedback;
			storyThemeDraftRef.current = cleanTheme;
			storyPracticeDraftRef.current = cleanPractice;
			storyFeedbackSubmittedAtRef.current = submittedAt;
			setStoryFeedback(cleanFeedback);
			setStoryFeedbackSubmittedAt(submittedAt);
			if (genre && activeSaveId) {
				void persistStory(
					makeStorySaveSnapshot.current({
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
						readingStory: readingStory ?? undefined,
						readingPartIndex: readingPartIndex ?? undefined,
						narrationVoice,
						storyRecapLesson: storyRecapLessonRef.current,
					}),
				);
			}
			if (readingStory && phase === "finished") {
				finalizeReadingEvidence(cleanFeedback, cleanTheme, cleanPractice);
			}
		},
		[
			activeSaveId,
			activeTitle,
			backgroundImage,
			backgroundIntro,
			currentTarget,
			genre,
			memory,
			messages,
			openingAudio,
			narrationVoice,
			persistStory,
			phase,
			readingStory,
			readingPartIndex,
			segments,
			finalizeReadingEvidence,
		],
	);

	// The tutor chat hands the learner's questions here as it closes, instead of
	// refining the profile immediately, so they fold once into the baseline at
	// story end. Deduped and bounded so repeated opens can't bloat the evidence.
	const captureBotQuestions = useCallback(
		(questions: string[]) => {
			const seen = new Set(botQuestionsRef.current);
			let changed = false;
			for (const raw of questions) {
				if (botQuestionsRef.current.length >= MAX_BUFFERED_BOT_QUESTIONS) break;
				const question = raw.trim().slice(0, MAX_BOT_QUESTION_CHARS);
				if (!question || seen.has(question)) continue;
				seen.add(question);
				botQuestionsRef.current.push(question);
				changed = true;
			}
			if (changed && genre && activeSaveId && readingStory) {
				void persistStory(
					makeStorySaveSnapshot.current({
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
						readingStory,
						readingPartIndex: readingPartIndex ?? undefined,
						narrationVoice,
						storyRecapLesson: storyRecapLessonRef.current,
					}),
				);
			}
		},
		[
			activeSaveId,
			activeTitle,
			backgroundImage,
			backgroundIntro,
			currentTarget,
			genre,
			memory,
			messages,
			narrationVoice,
			openingAudio,
			persistStory,
			phase,
			readingPartIndex,
			readingStory,
			segments,
		],
	);

	const handleRegenerateWord = useCallback(
		async (word: string): Promise<string | null> => {
			try {
				const storyContext = readingStoryRef.current?.parts
					.map((part) => part.text)
					.join("\n");
				const translation = await regenerateWordTranslation(word, storyContext);
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
		completeStoryRecap,
		continueReadingStory,
		currentTarget,
		error,
		genre,
		handleTypingComplete,
		phase,
		startReadingStory,
		openingAudio:
			currentTarget &&
			isStoryOpeningAudioForText(openingAudio, currentTarget, narrationVoice)
				? openingAudio
				: null,
		openingAudioLoading,
		openingAudioError,
		retryOpeningAudio,
		narrationVoice,
		nonTranslatableWords: readingStory?.characterNames ?? [],
		regenerateWordTranslation: handleRegenerateWord,
		resumeStory,
		readingPartIndex,
		readingPreparationStatus: readingPreparation.status,
		retryReadingPreparation: readingPreparation.retry,
		readingTotalParts: readingStory?.parts.length ?? null,
		captureBotQuestions,
		retryStoryRecap,
		segments,
		selectGenre,
		skipStoryRecap,
		startLessonStory,
		streamingTarget,
		storyRecapError,
		storyRecapLesson,
		storyFeedbackSubmittedAt,
		storyFeedback,
		feedbackEditable,
		onStoryFeedbackDraftChange: handleStoryFeedbackDraftChange,
		submitContinuation,
		submitStoryFeedback,
		wordTranslations,
	};
}
