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
	{
		loadingMessage,
		successMessage,
		onSuccess,
	}: { loadingMessage?: string; successMessage?: string; onSuccess?: () => void } = {}
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
				if (onSuccess) {
					onSuccess();
				} else {
					router.push(result.redirect);
				}
			}
		},
	});
}
