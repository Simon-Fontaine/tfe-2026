"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiPatch } from "@/lib/api-client";
import { apiRoutes, appRoutes, publicRoutes } from "@/lib/routes";

function revalidateProfileSurfaces() {
	revalidatePath(appRoutes.root);
	revalidatePath(appRoutes.me);
	revalidatePath(appRoutes.profile);
	revalidatePath(appRoutes.recruiting.root);
	revalidatePath(publicRoutes.players.root);
	revalidatePath(publicRoutes.recruiting.root);
}

export async function updateGameProfileAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const rawDivision = formData.get("rankDivision");

	const res = await apiPatch(apiRoutes.profile.game, {
		battletag: formData.get("battletag") || undefined,
		primaryRole: String(formData.get("primaryRole") ?? ""),
		secondaryRole: formData.get("secondaryRole") || null,
		rank: formData.get("rank") || null,
		rankDivision: rawDivision ? Number(rawDivision) : null,
		heroPool: formData.getAll("heroPool[]") as string[],
		profileVisibility: formData.get("profileVisibility"),
		participationIntent: formData.get("participationIntent"),
		availabilityIntent: formData.get("availabilityIntent"),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateProfileSurfaces();
	return { success: true };
}
