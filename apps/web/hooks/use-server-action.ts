"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

/** Minimum shape every server action result must satisfy. */
export type ServerActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

/**
 * Core primitive for calling a Server Action with automatic loading/error toast management.
 *
 * Uses `startTransition(async () => {...})` (React 19) so toasts are managed
 * synchronously after the action resolves — no `useEffect` timing issues.
 *
 * Error and fieldErrors are handled here. Pass `onResult` to handle
 * hook-specific success cases (redirect, step transition, success flag, …).
 */
export function useServerAction<T extends ServerActionResult>(
	action: (prev: T | null, formData: FormData) => Promise<T>,
	{
		loadingMessage,
		onResult,
	}: {
		loadingMessage?: string;
		onResult: (result: T, toastId: string | number | undefined) => void;
	}
) {
	const [isPending, startTransition] = useTransition();
	const [state, setState] = useState<T | null>(null);
	const prevStateRef = useRef<T | null>(null);

	function submit(formData: FormData) {
		startTransition(async () => {
			const toastId = loadingMessage ? toast.loading(loadingMessage) : undefined;

			let result: T;
			try {
				result = await action(prevStateRef.current, formData);
			} catch {
				// Unexpected throw (e.g. network error). Dismiss and abort.
				toast.dismiss(toastId);
				return;
			}

			prevStateRef.current = result;
			setState(result);

			if (result.error) {
				toast.error(result.error, { id: toastId });
				return;
			}

			if (result.fieldErrors) {
				toast.dismiss(toastId);
				const msgs = Object.values(result.fieldErrors).flat().filter(Boolean) as string[];
				for (const msg of msgs) toast.error(msg);
				return;
			}

			onResult(result, toastId);
		});
	}

	return { state, submit, isPending };
}
