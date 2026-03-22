"use server";

import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";

export async function twoFactorAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/2fa/totp", {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}

export async function recoveryCodeAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/2fa/recovery", {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error };
	return res;
}
