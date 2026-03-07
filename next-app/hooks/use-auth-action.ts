"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/app/(auth)/auth/actions";
import { useAuthFlow } from "@/stores/auth-flow";
import { useServerAction } from "./use-server-action";

export function useAuthAction(
	action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>,
	{ loadingMessage, successMessage }: { loadingMessage?: string; successMessage?: string } = {}
) {
	const { transitionTo } = useAuthFlow();
	const router = useRouter();

	return useServerAction<ActionResult>(action, {
		loadingMessage,
		onResult: (result, toastId) => {
			if (result.nextStep) {
				toast.dismiss(toastId);
				transitionTo(result.nextStep, {
					email: result.email,
					next: result.next,
					twoFactorMethods: result.twoFactorMethods,
				});
				return;
			}

			if (result.redirect) {
				if (successMessage) {
					toast.success(successMessage, { id: toastId });
				} else {
					toast.dismiss(toastId);
				}
				router.push(result.redirect);
			}
		},
	});
}
