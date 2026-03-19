"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

export type FormActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	success?: boolean;
};

/**
 * Hook for profile/settings forms that submit data and show success/error toasts.
 * Uses `useActionState` so `formAction` can be passed as a native `<form action>`.
 * Toast lifecycle is managed via a stored ID so the loading toast is replaced
 * in-place rather than dismissed and re-created separately.
 */
export function useFormAction<T extends FormActionResult>(
	action: (prev: T | null, formData: FormData) => Promise<T>,
	{ loadingMessage, successMessage }: { loadingMessage?: string; successMessage?: string } = {}
) {
	const [state, formAction, isActionPending] = useActionState(action, null);
	const [isTransitionPending, startTransition] = useTransition();
	const toastIdRef = useRef<string | number | undefined>(undefined);
	const loadingRef = useRef(false);

	// Show loading toast when the action starts; store the ID for later replacement.
	useEffect(() => {
		if (isActionPending && !loadingRef.current) {
			loadingRef.current = true;
			toastIdRef.current = loadingMessage ? toast.loading(loadingMessage) : undefined;
		}
	}, [isActionPending, loadingMessage]);

	// Replace the loading toast once the result is available.
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

	function submit(formData: FormData) {
		startTransition(() => formAction(formData));
	}

	return { state, formAction, submit, isPending: isActionPending || isTransitionPending };
}
