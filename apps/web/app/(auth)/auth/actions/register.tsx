"use server";

import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import type { ActionResult } from "./types";

export async function registerAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.auth.register({
		email: String(formData.get("email") ?? ""),
		username: String(formData.get("username") ?? ""),
		displayName: formData.get("displayName")?.toString() || undefined,
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
	});

	const actionResult = toActionResult(result);
	return "data" in actionResult ? (actionResult.data as ActionResult) : actionResult;
}

export async function checkUsernameAction(username: string): Promise<{ available: boolean }> {
	const sdk = getServerSdk();
	const result = await sdk.auth.checkUsername(username);
	if (!result.ok) return { available: false };
	return result.data.data;
}
