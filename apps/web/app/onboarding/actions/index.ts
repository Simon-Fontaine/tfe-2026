"use server";

import type { OnboardingActionResult } from "@/hooks/use-onboarding-action";
import { apiPatch, apiPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

const MAX_NEXT_DESTINATION_LENGTH = 2048;

function isSafeAppRedirect(value: FormDataEntryValue | null): value is string {
	return (
		typeof value === "string" &&
		value.length <= MAX_NEXT_DESTINATION_LENGTH &&
		(value === appRoutes.root ||
			value.startsWith(`${appRoutes.root}/`) ||
			value.startsWith(`${appRoutes.root}?`)) &&
		!value.startsWith("//") &&
		!value.includes("\\")
	);
}

export async function updateOnboardingProgressAction(
	_prev: OnboardingActionResult | null,
	formData: FormData
): Promise<OnboardingActionResult> {
	const rawDivision = formData.get("rankDivision");

	const res = await apiPatch(apiRoutes.onboarding.progress, {
		currentStep: formData.get("currentStep") || undefined,
		battletag: formData.get("battletag") || undefined,
		primaryRole: formData.get("primaryRole") || null,
		secondaryRole: formData.get("secondaryRole") || null,
		rank: formData.get("rank") || null,
		rankDivision: rawDivision ? Number(rawDivision) : null,
		heroPool: formData.getAll("heroPool[]") as string[],
		participationIntent: formData.get("participationIntent") || null,
		availabilityIntent: formData.get("availabilityIntent") || null,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	return { success: true };
}

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
		participationIntent: String(formData.get("participationIntent") ?? ""),
		availabilityIntent: String(formData.get("availabilityIntent") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	const next = formData.get("next");
	return { redirect: isSafeAppRedirect(next) ? next : (res.redirect ?? appRoutes.root) };
}
