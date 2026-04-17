"use server";

import { apiAuthPost, apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./types";
import { toAuthActionResult } from "./utils";

export async function registerAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const result = await apiAuthPost<ActionResult>(apiRoutes.auth.register.root, {
		email: String(formData.get("email") ?? ""),
		username: String(formData.get("username") ?? ""),
		displayName: formData.get("displayName")?.toString() || undefined,
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
	});
	return toAuthActionResult(result);
}

export async function checkUsernameAction(username: string): Promise<{ available: boolean }> {
	const result = await apiGet<{ available: boolean }>(
		apiRoutes.auth.register.checkUsername(username)
	);
	if ("error" in result) return { available: false };
	return result.data;
}
