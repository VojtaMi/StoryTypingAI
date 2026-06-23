interface EsperantoChatButtonProps {
	onClick: () => void;
}

export function EsperantoChatButton({ onClick }: EsperantoChatButtonProps) {
	return (
		<button
			type="button"
			className="esperanto-chat-btn"
			onClick={onClick}
			title="Ask Esperanto Bot"
		>
			<svg
				width="18"
				height="18"
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
				<path
					d="M6.8 12C7.4 12.55 8.15 12.8 9 12.8C9.85 12.8 10.6 12.55 11.2 12"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
			<span>Ask</span>
		</button>
	);
}
