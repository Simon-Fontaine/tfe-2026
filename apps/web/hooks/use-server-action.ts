"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

/** Minimum shape every server action result must satisfy. */
export type ServerActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

function isNextNavigationError(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("digest" in error)) return false;
	const digest = (error as { digest?: unknown }).digest;
	return (
		typeof digest === "string" &&
		(digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
	);
}

/**
 * Calls a Server Action with automatic loading/error toast management. Errors and
 * fieldErrors are handled here; pass `onResult` for success cases (redirect, step, …).
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
	const activeToastIdRef = useRef<string | number | undefined>(undefined);

	useEffect(() => {
		return () => {
			if (activeToastIdRef.current !== undefined) toast.dismiss(activeToastIdRef.current);
			activeToastIdRef.current = undefined;
		};
	}, []);

	function submit(formData: FormData) {
		startTransition(async () => {
			const toastId = loadingMessage ? toast.loading(loadingMessage) : undefined;
			activeToastIdRef.current = toastId;

			let result: T;
			try {
				result = await action(prevStateRef.current, formData);
			} catch (error) {
				if (isNextNavigationError(error)) throw error;
				const errorResult = { error: "Something went wrong. Please try again." } as T;
				prevStateRef.current = errorResult;
				setState(errorResult);
				toast.error(errorResult.error, { id: toastId });
				activeToastIdRef.current = undefined;
				return;
			}

			prevStateRef.current = result;
			setState(result);

			if (result.error) {
				toast.error(result.error, { id: toastId });
				activeToastIdRef.current = undefined;
				return;
			}

			if (result.fieldErrors) {
				toast.dismiss(toastId);
				activeToastIdRef.current = undefined;
				const msgs = Object.values(result.fieldErrors).flat().filter(Boolean) as string[];
				for (const msg of msgs) toast.error(msg);
				return;
			}

			try {
				onResult(result, toastId);
			} catch {
				toast.error("Something went wrong. Please try again.", { id: toastId });
			} finally {
				activeToastIdRef.current = undefined;
			}
		});
	}

	return { state, submit, isPending };
}
