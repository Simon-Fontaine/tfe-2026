"use server";

import { apiDelete, apiPost } from "@/lib/api-client";
import type { ActionResult } from "./password";

export async function requestPasskeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const res = await apiPost("/api/settings/credentials/passkey/disable/request", {
		credentialId,
		credentialName,
	});
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmPasskeyDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/credentials/passkey/disable/confirm", { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelPasskeyDisableAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/credentials/passkey/disable/request");
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function requestSecurityKeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const res = await apiPost("/api/settings/credentials/security-key/disable/request", {
		credentialId,
		credentialName,
	});
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmSecurityKeyDisableAction(code: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/credentials/security-key/disable/confirm", { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelSecurityKeyDisableAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/credentials/security-key/disable/request");
	if ("error" in res) return { error: res.error };
	return { success: true };
}
