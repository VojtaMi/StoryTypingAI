import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
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
	onOpen: () => void;
	segments: StorySegment[];
	currentTarget: string | null;
	backgroundIntro?: string;
	model: TextModelId;
	onClose: () => void;
}

const STARTER_QUESTION = "Can you explain this sentence?";
const BOT_IMAGE_URL = "/images/esperanto-bot-retro.png";
type ChatEntry = EsperantoTutorChatMessage & { id: string };
type AssistantPosition = { x: number; y: number };

export function EsperantoChatModal({
	isOpen,
	onOpen,
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
	const rootRef = useRef<HTMLDivElement>(null);
	const nextMessageIdRef = useRef(0);
	const [position, setPosition] = useState<AssistantPosition | null>(null);

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

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function handleRobotPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
		if (event.button !== 0) return;
		const root = rootRef.current;
		if (!root) return;

		const rect = root.getBoundingClientRect();
		const startX = event.clientX;
		const startY = event.clientY;
		let didDrag = false;

		function move(moveEvent: PointerEvent) {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			if (Math.abs(dx) + Math.abs(dy) > 5) didDrag = true;
			setPosition({
				x: clamp(rect.left + dx, 12, window.innerWidth - rect.width - 12),
				y: clamp(rect.top + dy, 12, window.innerHeight - rect.height - 12),
			});
		}

		function up() {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			if (!didDrag) {
				if (isOpen) onClose();
				else onOpen();
			}
		}

		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up, { once: true });
	}

	const canUseDraggedPosition =
		typeof window === "undefined" || window.innerWidth > 620;
	const assistantStyle =
		position && canUseDraggedPosition
			? { left: `${position.x}px`, top: `${position.y}px` }
			: undefined;

	return (
		<div
			className={`esperanto-chat-assistant${
				isOpen ? " esperanto-chat-assistant--open" : ""
			}`}
			ref={rootRef}
			style={assistantStyle}
		>
			<button
				type="button"
				className="esperanto-bot-character"
				onPointerDown={handleRobotPointerDown}
				aria-label={isOpen ? "Close Esperanto Bot" : "Ask Esperanto Bot"}
				title={isOpen ? "Close Esperanto Bot" : "Ask Esperanto Bot"}
			>
				<img src={BOT_IMAGE_URL} alt="" draggable={false} />
				<span className="esperanto-bot-bubble">{isOpen ? "Close" : "Ask"}</span>
			</button>

			{isOpen && (
				<section
					className="esperanto-chat-panel"
					role="dialog"
					aria-label="Esperanto Bot"
				>
					<header className="esperanto-chat-header">
						<div className="esperanto-chat-title">
							<span className="esperanto-chat-avatar" aria-hidden="true">
								<img src={BOT_IMAGE_URL} alt="" draggable={false} />
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
			)}
		</div>
	);
}
