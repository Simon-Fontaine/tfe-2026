"use server";

import type { PersonalPrivacySettingsInput, SessionValidationResult } from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import { apiGet, apiPatch } from "@/lib/api-client";
import { apiRoutes, appRoutes, publicRoutes } from "@/lib/routes";

type SettingsActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	success?: boolean;
};

export async function updatePrivacySettingsAction(
	input: PersonalPrivacySettingsInput
): Promise<SettingsActionResult> {
	const sessionRes = await apiGet<SessionValidationResult>(apiRoutes.auth.session);
	const res = await apiPatch(apiRoutes.settings.privacy, input);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(appRoutes.settings.privacy);
	revalidatePath(appRoutes.profile);
	revalidatePath(publicRoutes.players.root);
	revalidatePath(publicRoutes.recruiting.root);
	revalidatePath(appRoutes.recruiting.root);
	if ("data" in sessionRes && sessionRes.data.user?.username) {
		revalidatePath(publicRoutes.players.byUsername(sessionRes.data.user.username));
	}

	return { success: true };
}
