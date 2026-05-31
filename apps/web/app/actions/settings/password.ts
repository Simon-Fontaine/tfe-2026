"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function requestPasswordChangeAction(currentPassword: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.password.request, { currentPassword });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmPasswordChangeAction(
	code: string,
	newPassword: string
): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.password.confirm, { code, newPassword });
	if ("error" in res) return { error: res.error };
	revalidatePath(appRoutes.settings.security);
	return { success: true };
}

export async function cancelPasswordChangeAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.password.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
