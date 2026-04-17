"use server";

import { apiDelete, apiPost } from "@/lib/api-client";
import type { ActionResult } from "./password";

export async function requestTwoFactorDisableAction(): Promise<ActionResult> {
	const res = await apiPost("/api/settings/2fa/request");
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmTwoFactorDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/2fa/confirm", { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelTwoFactorDisableAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/2fa/request");
	if ("error" in res) return { error: res.error };
	return { success: true };
}
