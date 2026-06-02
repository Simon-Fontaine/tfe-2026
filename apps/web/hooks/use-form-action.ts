"use client";

import { useActionState, useCallback, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

export type FormActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	success?: boolean;
};

function isNextNavigationError(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("digest" in error)) return false;
	const digest = (error as { digest?: unknown }).digest;
	return (
		typeof digest === "string" &&
		(digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
	);
}

/** Form-action hook with success/error toasts; replaces the loading toast in-place via a stored ID. */
export function useFormAction<T extends FormActionResult>(
	action: (prev: T | null, formData: FormData) => Promise<T>,
	{ loadingMessage, successMessage }: { loadingMessage?: string; successMessage?: string } = {}
) {
	const safeAction = useCallback(
		async (prev: T | null, formData: FormData): Promise<T> => {
			try {
				return await action(prev, formData);
			} catch (error) {
				if (isNextNavigationError(error)) throw error;
				return { error: "Something went wrong. Please try again." } as T;
			}
		},
		[action]
	);

	const [state, formAction, isActionPending] = useActionState(safeAction, null);
	const [isTransitionPending, startTransition] = useTransition();
	const toastIdRef = useRef<string | number | undefined>(undefined);
	const loadingRef = useRef(false);

	useEffect(() => {
		if (isActionPending && !loadingRef.current) {
			loadingRef.current = true;
			toastIdRef.current = loadingMessage ? toast.loading(loadingMessage) : undefined;
		}
	}, [isActionPending, loadingMessage]);

	useEffect(() => {
		if (state === null) return;

		loadingRef.current = false;

		if (state.error) {
			toast.error(state.error, { id: toastIdRef.current });
			toastIdRef.current = undefined;
			return;
		}

		if (state.fieldErrors) {
			toast.dismiss(toastIdRef.current);
			toastIdRef.current = undefined;
			const messages = Object.values(state.fieldErrors).flat().filter(Boolean) as string[];
			for (const msg of messages) toast.error(msg);
			return;
		}

		if (state.success && successMessage) {
			toast.success(successMessage, { id: toastIdRef.current });
		} else {
			toast.dismiss(toastIdRef.current);
		}
		toastIdRef.current = undefined;
	}, [state, successMessage]);

	useEffect(() => {
		return () => {
			if (toastIdRef.current !== undefined) toast.dismiss(toastIdRef.current);
			toastIdRef.current = undefined;
			loadingRef.current = false;
		};
	}, []);

	function submit(formData: FormData) {
		startTransition(() => formAction(formData));
	}

	return { state, formAction, submit, isPending: isActionPending || isTransitionPending };
}
