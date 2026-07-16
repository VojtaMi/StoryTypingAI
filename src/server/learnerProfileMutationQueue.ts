let learnerProfileMutationQueue: Promise<void> = Promise.resolve();

/** Serialize every mutation of learner/state.json, regardless of its source. */
export function enqueueLearnerProfileMutation<T>(
	task: () => Promise<T>,
): Promise<T> {
	const next = learnerProfileMutationQueue.catch(() => undefined).then(task);
	learnerProfileMutationQueue = next.then(
		() => undefined,
		() => undefined,
	);
	return next;
}
