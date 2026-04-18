"use server";

import type { OnboardingActionResult } from "@/hooks/use-onboarding-action";
import { apiPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

export async function createPlayerProfileAction(
	_prev: OnboardingActionResult | null,
	formData: FormData
): Promise<OnboardingActionResult> {
	const rawDivision = formData.get("rankDivision");

	const res = await apiPost<{ redirect?: string }>(apiRoutes.onboarding.profile, {
		battletag: formData.get("battletag") || undefined,
		primaryRole: String(formData.get("primaryRole") ?? ""),
		secondaryRole: formData.get("secondaryRole") || null,
		rank: formData.get("rank") || null,
		rankDivision: rawDivision ? Number(rawDivision) : null,
		heroPool: formData.getAll("heroPool[]") as string[],
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	return { redirect: res.redirect ?? appRoutes.root };
}
