"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useServerAction } from "./use-server-action";

export type OnboardingActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	redirect?: string;
};

export function useOnboardingAction(
	action: (
		prev: OnboardingActionResult | null,
		formData: FormData
	) => Promise<OnboardingActionResult>,
	{ loadingMessage, successMessage }: { loadingMessage?: string; successMessage?: string } = {}
) {
	const router = useRouter();

	return useServerAction<OnboardingActionResult>(action, {
		loadingMessage,
		onResult: (result, toastId) => {
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
