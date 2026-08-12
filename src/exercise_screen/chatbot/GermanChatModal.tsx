import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	askGermanTutor,
	type GermanTutorChatMessage,
	refineLearnerProfileFromChat,
} from "../../ai";
import {
	readSelectedChatModel,
	saveSelectedChatModel,
} from "../../modelSelection/modelSelectionStore";
import { TEXT_MODELS, type TextModelId } from "../../models";
import type { StorySegment } from "../types";

interface GermanChatModalProps {
	isOpen: boolean;
	onOpen: () => void;
	segments: StorySegment[];
	currentTarget: string | null;
	backgroundIntro?: string;
	onClose: () => void;
	/**
	 * When set (reading stories), the learner's questions are handed here to be
	 * folded once into the finish baseline instead of refining the profile
	 * immediately. When absent (typing / menu), the immediate refine is used.
	 */
	onCaptureQuestions?: (questions: string[]) => void;
}

const BOT_IMAGE_URL = "/images/german-bot.png";
type ChatEntry = GermanTutorChatMessage & { id: string };

export function GermanChatModal({
	isOpen,
	onOpen,
	segments,
	currentTarget,
	backgroundIntro,
	onClose,
	onCaptureQuestions,
}: GermanChatModalProps) {
	const [messages, setMessages] = useState<ChatEntry[]>([]);
	const [input, setInput] = useState("");
	const [model, setModel] = useState<TextModelId>(readSelectedChatModel);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const logRef = useRef<HTMLDivElement>(null);
	const nextMessageIdRef = useRef(0);
	const sessionIdRef = useRef(0);

	const closeChat = useCallback(() => {
		// Fold this session's questions before the transcript is wiped below. In a
		// reading story, hand the learner's own questions to the session buffer so
		// they fold once into the finish baseline; everywhere else, refine the
		// handout immediately. Fire-and-forget either way — never block closing.
		if (messages.length > 0) {
			if (onCaptureQuestions) {
				onCaptureQuestions(
					messages
						.filter((message) => message.role === "user")
						.map((message) => message.content),
				);
			} else {
				void refineLearnerProfileFromChat(
					messages.map(({ role, content }) => ({ role, content })),
				);
			}
		}
		sessionIdRef.current += 1;
		nextMessageIdRef.current = 0;
		setMessages([]);
		setInput("");
		setError(null);
		setIsSending(false);
		onClose();
	}, [messages, onClose, onCaptureQuestions]);

	function createMessage(
		role: GermanTutorChatMessage["role"],
		content: string,
	): ChatEntry {
		const id = nextMessageIdRef.current;
		nextMessageIdRef.current += 1;
		return { id: `german-chat-${id}`, role, content };
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
			const answer = await askGermanTutor({
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
			setError(`German Bot could not answer: ${message}`);
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
				aria-label={isOpen ? "Close German Bot" : "Ask German Bot"}
				title={isOpen ? "Close German Bot" : "Ask German Bot"}
			>
				<img src={BOT_IMAGE_URL} alt="" draggable={false} />
			</button>

			{isOpen && (
				<section
					className="esperanto-chat-panel"
					role="dialog"
					aria-label="German Bot"
				>
					<header className="esperanto-chat-header">
						<div className="esperanto-chat-title">
							<span className="esperanto-chat-avatar" aria-hidden="true">
								<img src={BOT_IMAGE_URL} alt="" draggable={false} />
							</span>
							<div>
								<h2>German Bot</h2>
								<p>Ask about the story, grammar, or vocabulary.</p>
							</div>
						</div>
						<button
							type="button"
							className="esperanto-chat-close"
							onClick={closeChat}
							aria-label="Close German Bot"
						>
							✕
						</button>
					</header>

					<div className="esperanto-chat-toolbar">
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
									Hello. I can explain the current passage or answer follow-up
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
							placeholder="Ask your question..."
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
