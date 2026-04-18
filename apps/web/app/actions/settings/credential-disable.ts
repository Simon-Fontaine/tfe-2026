"use server";

import { apiDelete, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./password";

export async function requestPasskeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.credentials.passkey.disable.request, {
		credentialId,
		credentialName,
	});
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmPasskeyDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.credentials.passkey.disable.confirm, { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelPasskeyDisableAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.credentials.passkey.disable.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function requestSecurityKeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.credentials.securityKey.disable.request, {
		credentialId,
		credentialName,
	});
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmSecurityKeyDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.credentials.securityKey.disable.confirm, { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelSecurityKeyDisableAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.credentials.securityKey.disable.request);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
