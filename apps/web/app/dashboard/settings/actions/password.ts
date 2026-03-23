"use server";

import { apiDelete, apiPost } from "@/lib/api-client";

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function requestPasswordChangeAction(currentPassword: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/password/request", { currentPassword });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmPasswordChangeAction(
	code: string,
	newPassword: string
): Promise<ActionResult> {
	const res = await apiPost("/api/settings/password/confirm", { code, newPassword });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelPasswordChangeAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/password/request");
	if ("error" in res) return { error: res.error };
	return { success: true };
}
