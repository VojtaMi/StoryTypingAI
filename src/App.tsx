import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type ChatMessage,
	continueStory,
	generateStoryBackgroundImage,
	startStory,
	titleStory,
} from "./ai";
import { type Genre, genres } from "./genres";
import Menu from "./Menu";
import { consumePreparedOpening, prepareMissingOpenings } from "./openings";
import StoryView, { type StoryPhase, type StorySegment } from "./StoryView";
import {
	deleteSavedStory,
	listSavedStories,
	loadSavedStory,
	type SavedStory,
	type SavedStorySummary,
	saveStory,
} from "./saves";
import type { StoryBackgroundImage } from "./storyBackground";
import type { TypingStats } from "./TypingExercise";

type View = "menu" | "story";

export default function App() {
	const [view, setView] = useState<View>("menu");
	const [genre, setGenre] = useState<Genre | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [segments, setSegments] = useState<StorySegment[]>([]);
	const [currentTarget, setCurrentTarget] = useState<string | null>(null);
	const [phase, setPhase] = useState<StoryPhase>("loading");
	const [error, setError] = useState<string | null>(null);
	const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
	const [activeTitle, setActiveTitle] = useState<string | null>(null);
	const [backgroundImage, setBackgroundImage] =
		useState<StoryBackgroundImage | null>(null);
	const [visibleBackgroundUrl, setVisibleBackgroundUrl] = useState<
		string | null
	>(null);
	const [previousBackgroundUrl, setPreviousBackgroundUrl] = useState<
		string | null
	>(null);
	const [isBackgroundFading, setIsBackgroundFading] = useState(false);
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const activeSaveIdRef = useRef<string | null>(null);
	const activeTitleRef = useRef<string | null>(null);
	const messagesRef = useRef<ChatMessage[]>([]);
	const segmentsRef = useRef<StorySegment[]>([]);
	const currentTargetRef = useRef<string | null>(null);
	const phaseRef = useRef<StoryPhase>("loading");
	const backgroundFadeTimeoutRef = useRef<number | null>(null);
	const preparingOpeningsRef = useRef(false);

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
		segmentsRef.current = segments;
	}, [segments]);

	useEffect(() => {
		currentTargetRef.current = currentTarget;
	}, [currentTarget]);

	useEffect(() => {
		phaseRef.current = phase;
	}, [phase]);

	useEffect(() => {
		document.body.dataset.view = view;
		if (genre) {
			document.body.dataset.genre = genre.id;
		} else {
			delete document.body.dataset.genre;
		}
		return () => {
			delete document.body.dataset.view;
			delete document.body.dataset.genre;
		};
	}, [view, genre]);

	useEffect(() => {
		const nextUrl =
			view === "story" ? (backgroundImage?.backgroundImageUrl ?? null) : null;

		if (backgroundFadeTimeoutRef.current !== null) {
			window.clearTimeout(backgroundFadeTimeoutRef.current);
			backgroundFadeTimeoutRef.current = null;
		}

		if (!nextUrl) {
			setVisibleBackgroundUrl(null);
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			return;
		}

		if (!visibleBackgroundUrl) {
			setVisibleBackgroundUrl(nextUrl);
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			return;
		}

		if (visibleBackgroundUrl === nextUrl) return;

		setPreviousBackgroundUrl(visibleBackgroundUrl);
		setVisibleBackgroundUrl(nextUrl);
		setIsBackgroundFading(true);
		backgroundFadeTimeoutRef.current = window.setTimeout(() => {
			setPreviousBackgroundUrl(null);
			setIsBackgroundFading(false);
			backgroundFadeTimeoutRef.current = null;
		}, 1200);

		return () => {
			if (backgroundFadeTimeoutRef.current !== null) {
				window.clearTimeout(backgroundFadeTimeoutRef.current);
				backgroundFadeTimeoutRef.current = null;
			}
		};
	}, [view, backgroundImage, visibleBackgroundUrl]);

	function describeError(err: unknown): string {
		const message = err instanceof Error ? err.message : String(err);
		return `Something went wrong reaching the AI: ${message}`;
	}

	function fallbackTitle(selected: Genre) {
		return `${selected.label} Story`;
	}

	function createSaveId() {
		if (crypto.randomUUID) return crypto.randomUUID();
		return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function fallbackBackgroundImage(selected: Genre): StoryBackgroundImage {
		return {
			backgroundImageUrl: `/images/fallback-${selected.id}.webp`,
			backgroundImageSource: "fallback",
		};
	}

	function backgroundFromOpening(
		opening: {
			backgroundImageUrl?: string;
			backgroundImagePrompt?: string;
			backgroundImageSource?: string;
			text?: string;
			messages?: ChatMessage[];
		},
		selected: Genre,
	): StoryBackgroundImage {
		if (
			opening.backgroundImageUrl &&
			(opening.backgroundImageSource === "generated" ||
				opening.backgroundImageSource === "fallback")
		) {
			return {
				backgroundImageUrl: opening.backgroundImageUrl,
				backgroundImagePrompt: opening.backgroundImagePrompt,
				backgroundImageSource: opening.backgroundImageSource,
			};
		}
		return fallbackBackgroundImage(selected);
	}

	function saveBackgroundFields() {
		return backgroundImage ?? undefined;
	}

	function backgroundLayerStyle(url: string): CSSProperties {
		return { "--background-url": `url("${url}")` } as CSSProperties;
	}

	function shouldGenerateNextBackground(storyMessages: ChatMessage[]) {
		const assistantCount = storyMessages.filter(
			(message) => message.role === "assistant",
		).length;
		return assistantCount > 1 && assistantCount % 2 === 1;
	}

	async function refreshStoryBackground(
		selected: Genre,
		saveId: string,
		storyMessages: ChatMessage[],
	) {
		if (!shouldGenerateNextBackground(storyMessages)) return;

		try {
			const nextBackgroundImage = await generateStoryBackgroundImage(
				selected.id,
				storyMessages,
			);
			if (
				activeSaveIdRef.current !== saveId ||
				nextBackgroundImage.backgroundImageSource !== "generated"
			) {
				return;
			}

			setBackgroundImage(nextBackgroundImage);
			void persistStory({
				id: saveId,
				genreId: selected.id,
				title: activeTitleRef.current ?? fallbackTitle(selected),
				messages: messagesRef.current,
				segments: segmentsRef.current,
				currentTarget: currentTargetRef.current,
				phase: phaseRef.current,
				...nextBackgroundImage,
			});
		} catch (err) {
			console.warn("Could not refresh the story background image.", err);
		}
	}

	const refreshSavedStories = useCallback(async () => {
		try {
			setSavesError(null);
			setSavedStories(await listSavedStories());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not read local saves: ${message}`);
		}
	}, []);

	const prepareOpeningsInBackground = useCallback(async () => {
		if (preparingOpeningsRef.current) return;
		preparingOpeningsRef.current = true;
		try {
			await prepareMissingOpenings();
		} catch (err) {
			console.warn("Could not prepare story openings.", err);
		} finally {
			preparingOpeningsRef.current = false;
		}
	}, []);

	useEffect(() => {
		void (async () => {
			await refreshSavedStories();
			void prepareOpeningsInBackground();
		})();
	}, [refreshSavedStories, prepareOpeningsInBackground]);

	useEffect(() => {
		if (view === "menu") void prepareOpeningsInBackground();
	}, [view, prepareOpeningsInBackground]);

	async function persistStory(
		save: Omit<SavedStory, "updatedAt">,
		options: { generateTitle?: boolean } = {},
	) {
		const stamped: SavedStory = {
			...save,
			updatedAt: new Date().toISOString(),
		};

		try {
			setSavesError(null);
			await saveStory(stamped);
			await refreshSavedStories();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not save story: ${message}`);
			return;
		}

		if (!options.generateTitle) return;

		try {
			const title = await titleStory(save.messages);
			if (!title) return;
			const titled = {
				...stamped,
				title,
				updatedAt: new Date().toISOString(),
			};
			if (activeSaveIdRef.current === save.id) setActiveTitle(title);
			await saveStory(titled);
			await refreshSavedStories();
		} catch {
			// The fallback title has already been saved, so title failures should not
			// block the local save flow.
		}
	}

	async function selectGenre(selected: Genre) {
		const saveId = createSaveId();
		const title = fallbackTitle(selected);

		activeSaveIdRef.current = saveId;
		setActiveSaveId(saveId);
		setActiveTitle(title);
		setGenre(selected);
		setMessages([]);
		setSegments([]);
		setCurrentTarget(null);
		setError(null);
		setPhase("loading");
		setView("story");
		try {
			let opening: { text: string; messages: ChatMessage[] } | null = null;
			try {
				opening = await consumePreparedOpening(selected.id);
			} catch (err) {
				console.warn("Could not consume a prepared opening.", err);
			}

			if (!opening) {
				opening = await startStory(selected);
			} else {
				void prepareOpeningsInBackground();
			}

			const { text, messages: seeded } = opening;
			const nextBackgroundImage = backgroundFromOpening(opening, selected);
			setMessages(seeded);
			setCurrentTarget(text);
			setBackgroundImage(nextBackgroundImage);
			setPhase("typing");
			void persistStory(
				{
					id: saveId,
					genreId: selected.id,
					title,
					messages: seeded,
					segments: [],
					currentTarget: text,
					phase: "typing",
					...nextBackgroundImage,
				},
				{ generateTitle: true },
			);
		} catch (err) {
			setError(describeError(err));
		}
	}

	function handleTypingComplete(_stats: TypingStats) {
		if (currentTarget === null) return;
		const nextSegments: StorySegment[] = [
			...segments,
			{ id: segments.length, author: "ai", text: currentTarget },
		];
		setSegments(nextSegments);
		setCurrentTarget(null);
		setPhase("authoring");
		if (genre && activeSaveId) {
			void persistStory({
				id: activeSaveId,
				genreId: genre.id,
				title: activeTitle ?? fallbackTitle(genre),
				messages,
				segments: nextSegments,
				currentTarget: null,
				phase: "authoring",
				...saveBackgroundFields(),
			});
		}
	}

	async function submitContinuation(userText: string) {
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
		setError(null);
		setPhase("loading");
		void persistStory({
			id: activeSaveId,
			genreId: genre.id,
			title: activeTitle ?? fallbackTitle(genre),
			messages: userMessages,
			segments: nextSegments,
			currentTarget: null,
			phase: "loading",
			...saveBackgroundFields(),
		});

		try {
			const { text, messages: updated } = await continueStory(
				messages,
				userText,
			);
			setMessages(updated);
			setCurrentTarget(text);
			setPhase("typing");
			void persistStory(
				{
					id: activeSaveId,
					genreId: genre.id,
					title: activeTitle ?? fallbackTitle(genre),
					messages: updated,
					segments: nextSegments,
					currentTarget: text,
					phase: "typing",
					...saveBackgroundFields(),
				},
				{ generateTitle: true },
			);
			void refreshStoryBackground(genre, activeSaveId, updated);
		} catch (err) {
			setError(describeError(err));
		}
	}

	function backToMenu() {
		if (genre && activeSaveId) {
			void persistStory({
				id: activeSaveId,
				genreId: genre.id,
				title: activeTitle ?? fallbackTitle(genre),
				messages,
				segments,
				currentTarget,
				phase,
				...saveBackgroundFields(),
			});
		}
		setView("menu");
		setGenre(null);
		setMessages([]);
		setSegments([]);
		setCurrentTarget(null);
		setError(null);
		setPhase("loading");
		setBackgroundImage(null);
		activeSaveIdRef.current = null;
		setActiveSaveId(null);
		setActiveTitle(null);
	}

	async function resumeStory(id: string) {
		try {
			setSavesError(null);
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
			setSegments(save.segments);
			setCurrentTarget(save.currentTarget);
			setPhase(save.phase);
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
			setView("story");
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not load story: ${message}`);
		}
	}

	async function removeSavedStory(id: string) {
		try {
			setSavesError(null);
			await deleteSavedStory(id);
			await refreshSavedStories();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not delete story: ${message}`);
		}
	}

	return (
		<div className={`app app--${view}`}>
			{view === "story" && visibleBackgroundUrl && (
				<>
					{previousBackgroundUrl && (
						<div
							className="story-background story-background--previous"
							style={backgroundLayerStyle(previousBackgroundUrl)}
						/>
					)}
					<div
						className={`story-background story-background--current${
							isBackgroundFading ? " story-background--fading" : ""
						}`}
						style={backgroundLayerStyle(visibleBackgroundUrl)}
					/>
				</>
			)}

			<header className="header">
				<h1>Story Typing Practice</h1>
				<p className="subtitle">
					{view === "story" && genre
						? `${genre.emoji} ${genre.label}`
						: "An interactive AI story"}
				</p>
			</header>

			{view === "menu" && (
				<Menu
					savedStories={savedStories}
					savesError={savesError}
					onSelect={selectGenre}
					onResume={resumeStory}
					onDelete={removeSavedStory}
				/>
			)}

			{view === "story" && genre && (
				<StoryView
					segments={segments}
					currentTarget={currentTarget}
					phase={phase}
					error={error}
					onTypingComplete={handleTypingComplete}
					onSubmitContinuation={submitContinuation}
					onBackToMenu={backToMenu}
				/>
			)}
		</div>
	);
}
