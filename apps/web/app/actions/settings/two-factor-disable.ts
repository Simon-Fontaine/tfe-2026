"use server";

import { apiDelete, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./password";

export async function requestTwoFactorDisableAction(): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.twoFactorDisable.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmTwoFactorDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.twoFactorDisable.confirm, { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelTwoFactorDisableAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.twoFactorDisable.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
