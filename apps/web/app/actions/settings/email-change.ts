"use server";

import { apiDelete, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./password";

export async function requestEmailChangeAction(newEmail: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.email.request, { newEmail });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function verifyEmailChangeAction(code: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.email.verify, { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelEmailChangeAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.email.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
