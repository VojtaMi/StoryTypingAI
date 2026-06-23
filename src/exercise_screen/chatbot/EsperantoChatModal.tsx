import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	askEsperantoTutor,
	type EsperantoTutorChatMessage,
	type EsperantoTutorLanguage,
} from "../../ai";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import type { TextModelId } from "../../models";
import type { StorySegment } from "../types";

interface EsperantoChatModalProps {
	isOpen: boolean;
	segments: StorySegment[];
	currentTarget: string | null;
	backgroundIntro?: string;
	model: TextModelId;
	onClose: () => void;
}

const STARTER_QUESTION = "Can you explain this sentence?";
type ChatEntry = EsperantoTutorChatMessage & { id: string };

export function EsperantoChatModal({
	isOpen,
	segments,
	currentTarget,
	backgroundIntro,
	model,
	onClose,
}: EsperantoChatModalProps) {
	const [messages, setMessages] = useState<ChatEntry[]>([]);
	const [input, setInput] = useState("");
	const [language, setLanguage] = useState<EsperantoTutorLanguage>("english");
	const [esperantoKeys, setEsperantoKeys] = useState(true);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const logRef = useRef<HTMLDivElement>(null);
	const nextMessageIdRef = useRef(0);

	function createMessage(
		role: EsperantoTutorChatMessage["role"],
		content: string,
	): ChatEntry {
		const id = nextMessageIdRef.current;
		nextMessageIdRef.current += 1;
		return { id: `esperanto-chat-${id}`, role, content };
	}

	useEffect(() => {
		if (!isOpen) return undefined;
		inputRef.current?.focus();
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) return;
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
	});

	async function submitQuestion(question: string) {
		const trimmed = question.trim();
		if (!trimmed || isSending) return;

		const nextMessages: ChatEntry[] = [
			...messages,
			createMessage("user", trimmed),
		];
		setMessages(nextMessages);
		setInput("");
		setError(null);
		setIsSending(true);

		try {
			const answer = await askEsperantoTutor({
				segments,
				currentTarget,
				backgroundIntro,
				conversation: messages,
				question: trimmed,
				language,
				model,
			});
			setMessages([...nextMessages, createMessage("assistant", answer)]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(`Esperanto Bot could not answer: ${message}`);
		} finally {
			setIsSending(false);
		}
	}

	function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void submitQuestion(input);
			return;
		}

		if (!esperantoKeys || event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		const mapped = ESPERANTO_KEY_MAP[event.key];
		if (!mapped) return;
		event.preventDefault();
		const inputEl = event.currentTarget;
		const start = inputEl.selectionStart;
		const end = inputEl.selectionEnd;
		const next = `${input.slice(0, start)}${mapped}${input.slice(end)}`;
		setInput(next);
		window.requestAnimationFrame(() => {
			inputEl.selectionStart = start + mapped.length;
			inputEl.selectionEnd = start + mapped.length;
		});
	}

	if (!isOpen) return null;

	return (
		<div className="esperanto-chat-overlay">
			<button
				type="button"
				className="esperanto-chat-backdrop"
				onClick={onClose}
				aria-label="Close Esperanto Bot"
				tabIndex={-1}
			/>
			<section
				className="esperanto-chat-modal"
				role="dialog"
				aria-modal="true"
				aria-label="Esperanto Bot"
			>
				<header className="esperanto-chat-header">
					<div className="esperanto-chat-title">
						<span className="esperanto-chat-avatar" aria-hidden="true">
							<svg
								width="22"
								height="22"
								viewBox="0 0 18 18"
								fill="none"
								aria-hidden="true"
							>
								<rect
									x="3"
									y="5"
									width="12"
									height="9"
									rx="3"
									stroke="currentColor"
									strokeWidth="1.5"
								/>
								<path
									d="M9 5V2.5M6.5 2.5H11.5"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
								<circle cx="7" cy="9" r="1" fill="currentColor" />
								<circle cx="11" cy="9" r="1" fill="currentColor" />
							</svg>
						</span>
						<div>
							<h2>Esperanto Bot</h2>
							<p>Ask about the story, grammar, or vocabulary.</p>
						</div>
					</div>
					<button
						type="button"
						className="esperanto-chat-close"
						onClick={onClose}
						aria-label="Close Esperanto Bot"
					>
						✕
					</button>
				</header>

				<div className="esperanto-chat-toolbar">
					<div className="esperanto-chat-toggle">
						<button
							type="button"
							data-active={language === "english"}
							onClick={() => setLanguage("english")}
						>
							EN
						</button>
						<button
							type="button"
							data-active={language === "esperanto"}
							onClick={() => setLanguage("esperanto")}
						>
							EO
						</button>
					</div>
					<button
						type="button"
						className="esperanto-chat-key-toggle"
						data-active={esperantoKeys}
						onClick={() => setEsperantoKeys((value) => !value)}
					>
						EO keys
					</button>
				</div>

				<div className="esperanto-chat-log" ref={logRef}>
					{messages.length === 0 ? (
						<div className="esperanto-chat-empty">
							<p>
								Saluton. I can explain the current passage or answer follow-up
								questions.
							</p>
							<button
								type="button"
								onClick={() => void submitQuestion(STARTER_QUESTION)}
							>
								{STARTER_QUESTION}
							</button>
						</div>
					) : (
						messages.map((message) => (
							<div
								className={`esperanto-chat-message esperanto-chat-message--${message.role}`}
								key={message.id}
							>
								{message.content}
							</div>
						))
					)}
					{isSending && (
						<div className="esperanto-chat-message esperanto-chat-message--assistant esperanto-chat-message--thinking">
							Thinking...
						</div>
					)}
				</div>

				{error && <p className="esperanto-chat-error">{error}</p>}

				<form
					className="esperanto-chat-form"
					onSubmit={(event) => {
						event.preventDefault();
						void submitQuestion(input);
					}}
				>
					<textarea
						ref={inputRef}
						value={input}
						onChange={(event) => setInput(event.target.value)}
						onKeyDown={handleKeyDown}
						rows={3}
						placeholder="Ask in English or Esperanto..."
					/>
					<button type="submit" disabled={!input.trim() || isSending}>
						Send
					</button>
				</form>
			</section>
		</div>
	);
}
