interface GalleryButtonProps {
	onClick: () => void;
}

export function GalleryButton({ onClick }: GalleryButtonProps) {
	return (
		<button
			type="button"
			className="gallery-btn"
			onClick={onClick}
			title="Image gallery"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
				aria-hidden="true"
			>
				<rect
					x="1"
					y="1"
					width="7"
					height="7"
					rx="1"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<rect
					x="10"
					y="1"
					width="7"
					height="7"
					rx="1"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<rect
					x="1"
					y="10"
					width="7"
					height="7"
					rx="1"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<rect
					x="10"
					y="10"
					width="7"
					height="7"
					rx="1"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</svg>
		</button>
	);
}
