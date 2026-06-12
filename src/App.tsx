import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, continueStory, startStory, titleStory } from "./ai";
import { type Genre, genres } from "./genres";
import Menu from "./Menu";
import StoryView, { type StoryPhase, type StorySegment } from "./StoryView";
import {
	deleteSavedStory,
	listSavedStories,
	loadSavedStory,
	type SavedStory,
	type SavedStorySummary,
	saveStory,
} from "./saves";
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
	const [savedStories, setSavedStories] = useState<SavedStorySummary[]>([]);
	const [savesError, setSavesError] = useState<string | null>(null);
	const activeSaveIdRef = useRef<string | null>(null);

	useEffect(() => {
		activeSaveIdRef.current = activeSaveId;
	}, [activeSaveId]);

	function describeError(err: unknown): string {
		if (!import.meta.env.VITE_OPENAI_API_KEY) {
			return "No API key found. Add VITE_OPENAI_API_KEY to .env.local and restart the dev server.";
		}
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

	const refreshSavedStories = useCallback(async () => {
		try {
			setSavesError(null);
			setSavedStories(await listSavedStories());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setSavesError(`Could not read local saves: ${message}`);
		}
	}, []);

	useEffect(() => {
		void refreshSavedStories();
	}, [refreshSavedStories]);

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
			const { text, messages: seeded } = await startStory(selected);
			setMessages(seeded);
			setCurrentTarget(text);
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
				},
				{ generateTitle: true },
			);
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
			});
		}
		setView("menu");
		setGenre(null);
		setMessages([]);
		setSegments([]);
		setCurrentTarget(null);
		setError(null);
		setPhase("loading");
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
		<div className="app">
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
