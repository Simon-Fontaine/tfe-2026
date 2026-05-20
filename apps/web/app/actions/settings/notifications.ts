"use server";

import type { NotificationPreferenceInput } from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

type SettingsActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	success?: boolean;
};

export async function updateNotificationPreferencesAction(
	input: NotificationPreferenceInput
): Promise<SettingsActionResult> {
	const res = await apiPatch(apiRoutes.settings.notificationPreferences, input);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(appRoutes.settings.notifications);
	return { success: true };
}
