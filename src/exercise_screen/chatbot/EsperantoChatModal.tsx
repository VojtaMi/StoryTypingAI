import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { askEsperantoTutor, type EsperantoTutorChatMessage } from "../../ai";
import { ESPERANTO_KEY_MAP } from "../../esperantoKeyboard";
import {
	readSelectedChatModel,
	saveSelectedChatModel,
} from "../../modelSelection/modelSelectionStore";
import { TEXT_MODELS, type TextModelId } from "../../models";
import type { StorySegment } from "../types";

interface EsperantoChatModalProps {
	isOpen: boolean;
	onOpen: () => void;
	segments: StorySegment[];
	currentTarget: string | null;
	backgroundIntro?: string;
	onClose: () => void;
}

const BOT_IMAGE_URL = "/images/esperanto-bot-retro.png";
type ChatEntry = EsperantoTutorChatMessage & { id: string };
type InputMode = "english" | "esperanto";

export function EsperantoChatModal({
	isOpen,
	onOpen,
	segments,
	currentTarget,
	backgroundIntro,
	onClose,
}: EsperantoChatModalProps) {
	const [messages, setMessages] = useState<ChatEntry[]>([]);
	const [input, setInput] = useState("");
	const [inputMode, setInputMode] = useState<InputMode>("english");
	const [model, setModel] = useState<TextModelId>(readSelectedChatModel);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const logRef = useRef<HTMLDivElement>(null);
	const nextMessageIdRef = useRef(0);
	const sessionIdRef = useRef(0);

	const closeChat = useCallback(() => {
		sessionIdRef.current += 1;
		nextMessageIdRef.current = 0;
		setMessages([]);
		setInput("");
		setError(null);
		setIsSending(false);
		onClose();
	}, [onClose]);

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
			if (event.key === "Escape") closeChat();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, closeChat]);

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
		const sessionId = sessionIdRef.current;

		try {
			const answer = await askEsperantoTutor({
				segments,
				currentTarget,
				backgroundIntro,
				conversation: messages,
				question: trimmed,
				model,
			});
			if (sessionId !== sessionIdRef.current) return;
			setMessages([...nextMessages, createMessage("assistant", answer)]);
		} catch (err) {
			if (sessionId !== sessionIdRef.current) return;
			const message = err instanceof Error ? err.message : String(err);
			setError(`Esperanto Bot could not answer: ${message}`);
		} finally {
			if (sessionId === sessionIdRef.current) {
				setIsSending(false);
			}
		}
	}

	function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void submitQuestion(input);
			return;
		}

		if (
			inputMode !== "esperanto" ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey
		) {
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

	return (
		<div
			className={`esperanto-chat-assistant${
				isOpen ? " esperanto-chat-assistant--open" : ""
			}`}
		>
			<button
				type="button"
				className="esperanto-bot-character"
				onClick={isOpen ? closeChat : onOpen}
				aria-label={isOpen ? "Close Esperanto Bot" : "Ask Esperanto Bot"}
				title={isOpen ? "Close Esperanto Bot" : "Ask Esperanto Bot"}
			>
				<img src={BOT_IMAGE_URL} alt="" draggable={false} />
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
							onClick={closeChat}
							aria-label="Close Esperanto Bot"
						>
							✕
						</button>
					</header>

					<div className="esperanto-chat-toolbar">
						<div className="esperanto-chat-toggle">
							<button
								type="button"
								data-active={inputMode === "english"}
								onClick={() => setInputMode("english")}
							>
								EN
							</button>
							<button
								type="button"
								data-active={inputMode === "esperanto"}
								onClick={() => setInputMode("esperanto")}
							>
								EO
							</button>
						</div>
						<label className="esperanto-chat-model">
							<span className="esperanto-chat-model-label">Model</span>
							<select
								value={model}
								onChange={(event) => {
									const next = event.target.value as TextModelId;
									setModel(next);
									saveSelectedChatModel(next);
								}}
							>
								{TEXT_MODELS.map((textModel) => (
									<option key={textModel.id} value={textModel.id}>
										{textModel.label}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="esperanto-chat-log" ref={logRef}>
						{messages.length === 0 ? (
							<div className="esperanto-chat-empty">
								<p>
									Saluton. I can explain the current passage or answer follow-up
									questions.
								</p>
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
							placeholder={
								inputMode === "esperanto"
									? "Demandu vian demandon..."
									: "Ask your question..."
							}
						/>
						<button type="submit" disabled={!input.trim() || isSending}>
							{inputMode === "esperanto" ? "Sendu" : "Send"}
						</button>
					</form>
				</section>
			)}
		</div>
	);
}
