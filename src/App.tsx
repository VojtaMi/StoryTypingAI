import { useState } from "react";
import { type ChatMessage, continueStory, startStory } from "./ai";
import type { Genre } from "./genres";
import Menu from "./Menu";
import StoryView, { type StoryPhase, type StorySegment } from "./StoryView";
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

	function describeError(err: unknown): string {
		if (!import.meta.env.VITE_OPENAI_API_KEY) {
			return "No API key found. Add VITE_OPENAI_API_KEY to .env.local and restart the dev server.";
		}
		const message = err instanceof Error ? err.message : String(err);
		return `Something went wrong reaching the AI: ${message}`;
	}

	async function selectGenre(selected: Genre) {
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
		} catch (err) {
			setError(describeError(err));
		}
	}

	function handleTypingComplete(_stats: TypingStats) {
		if (currentTarget === null) return;
		setSegments((prev) => [
			...prev,
			{ id: prev.length, author: "ai", text: currentTarget },
		]);
		setCurrentTarget(null);
		setPhase("authoring");
	}

	async function submitContinuation(userText: string) {
		setSegments((prev) => [
			...prev,
			{ id: prev.length, author: "user", text: userText },
		]);
		setError(null);
		setPhase("loading");
		try {
			const { text, messages: updated } = await continueStory(
				messages,
				userText,
			);
			setMessages(updated);
			setCurrentTarget(text);
			setPhase("typing");
		} catch (err) {
			setError(describeError(err));
		}
	}

	function backToMenu() {
		setView("menu");
		setGenre(null);
		setMessages([]);
		setSegments([]);
		setCurrentTarget(null);
		setError(null);
		setPhase("loading");
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

			{view === "menu" && <Menu onSelect={selectGenre} />}

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
