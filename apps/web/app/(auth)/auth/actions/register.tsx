"use server";

import { apiAuthPost, apiGet } from "@/lib/api-client";
import type { ActionResult } from "./types";

export async function registerAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/register", {
		email: String(formData.get("email") ?? ""),
		username: String(formData.get("username") ?? ""),
		displayName: formData.get("displayName")?.toString() || undefined,
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}

export async function checkUsernameAction(username: string): Promise<{ available: boolean }> {
	const res = await apiGet<{ available: boolean }>(
		`/api/auth/register/check-username?username=${encodeURIComponent(username.trim())}`
	);
	if ("data" in res) return res.data;
	return { available: false };
}
