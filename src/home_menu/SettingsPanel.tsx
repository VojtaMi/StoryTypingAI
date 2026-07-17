import { useEffect, useState } from "react";
import { fetchLearnerPreferences, updateLearnerPreferences } from "../ai";
import type { LearnerPreferences } from "../learnerState";
import {
	readSelectedChatModel,
	saveSelectedChatModel,
} from "../modelSelection/modelSelectionStore";
import { TEXT_MODELS, type TextModelId } from "../models";

interface SettingsPanelProps {
	model: TextModelId;
	onModelChange: (model: TextModelId) => void;
	onClose: () => void;
}

type EditablePreferences = Pick<LearnerPreferences, "prefer" | "avoid">;

type PreferencesDraft = Record<keyof EditablePreferences, string>;

function lines(values: string[]): string {
	return values.join("\n");
}

function list(value: string): string[] {
	return value
		.split("\n")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function SettingsPanel({
	model,
	onModelChange,
	onClose,
}: SettingsPanelProps) {
	const [chatModel, setChatModel] = useState<TextModelId>(
		readSelectedChatModel,
	);
	const [draft, setDraft] = useState<PreferencesDraft | null>(null);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void fetchLearnerPreferences()
			.then((loaded) => {
				if (cancelled) return;
				setDraft({
					prefer: lines(loaded.prefer),
					avoid: lines(loaded.avoid),
				});
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setMessage(error instanceof Error ? error.message : String(error));
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	function updateField(field: keyof EditablePreferences, value: string) {
		setDraft((current) => (current ? { ...current, [field]: value } : current));
	}

	async function save() {
		if (!draft) return;
		setSaving(true);
		setMessage(null);
		try {
			const preferences: EditablePreferences = {
				prefer: list(draft.prefer),
				avoid: list(draft.avoid),
			};
			await updateLearnerPreferences(preferences);
			saveSelectedChatModel(chatModel);
			setMessage("Settings saved.");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className="settings-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
		>
			<div className="settings-panel__card">
				<div className="settings-panel__header">
					<h2 id="settings-title">Settings</h2>
					<button
						type="button"
						className="settings-panel__close"
						onClick={onClose}
					>
						Close
					</button>
				</div>
				<div className="settings-panel__models">
					<label>
						Story model
						<select
							value={model}
							onChange={(event) =>
								onModelChange(event.target.value as TextModelId)
							}
						>
							{TEXT_MODELS.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
					</label>
					<label>
						Tutor model
						<select
							value={chatModel}
							onChange={(event) =>
								setChatModel(event.target.value as TextModelId)
							}
						>
							{TEXT_MODELS.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<h3>Story preferences</h3>
				<p className="settings-panel__hint">
					One preference per line. These edit the same preferences the app
					refines after stories.
				</p>
				{draft ? (
					<>
						<label>
							Prefer
							<textarea
								className="settings-panel__textarea--list"
								value={draft.prefer}
								onChange={(event) => updateField("prefer", event.target.value)}
							/>
						</label>
						<label>
							Avoid
							<textarea
								className="settings-panel__textarea--list"
								value={draft.avoid}
								onChange={(event) => updateField("avoid", event.target.value)}
							/>
						</label>
					</>
				) : (
					<p>Loading preferences…</p>
				)}
				<div className="settings-panel__footer">
					{message && <span role="status">{message}</span>}
					<button
						type="button"
						className="lesson-hero__start"
						onClick={() => void save()}
						disabled={!draft || saving}
					>
						{saving ? "Saving…" : "Save settings"}
					</button>
				</div>
			</div>
		</div>
	);
}
