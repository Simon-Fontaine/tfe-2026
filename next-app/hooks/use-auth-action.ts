"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/(auth)/auth/actions";
import { useAuthFlow } from "@/stores/auth-flow";

export function useAuthAction(
	action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>,
	{ loadingMessage }: { loadingMessage?: string } = {}
) {
	const { transitionTo } = useAuthFlow();
	const [state, formAction, isActionPending] = useActionState(action, null);
	const [isTransitionPending, startTransition] = useTransition();
	const loadingRef = useRef(false);

	useEffect(() => {
		if (isActionPending && !loadingRef.current) {
			loadingRef.current = true;
			if (loadingMessage) toast.loading(loadingMessage);
		}
		if (!isActionPending && loadingRef.current) {
			loadingRef.current = false;
			toast.dismiss();
		}
	}, [isActionPending, loadingMessage]);

	useEffect(() => {
		if (state === null) return;

		if (state.error) toast.error(state.error);

		if (state.fieldErrors) {
			const messages = Object.values(state.fieldErrors).flat().filter(Boolean) as string[];
			for (const msg of messages) {
				toast.error(msg);
			}
		}

		if (state.nextStep) {
			transitionTo(state.nextStep, {
				email: state.email,
				next: state.next,
				twoFactorMethods: state.twoFactorMethods,
			});
		}
	}, [state, transitionTo]);

	function submit(formData: FormData) {
		startTransition(() => {
			formAction(formData);
		});
	}

	return { state, formAction, submit, isPending: isActionPending || isTransitionPending };
}
