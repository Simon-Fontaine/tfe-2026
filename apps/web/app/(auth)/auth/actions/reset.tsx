"use server";

import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";

export async function forgotPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/forgot-password", {
		email: String(formData.get("email") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}

export async function resetPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/reset-password", {
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
		reset_token: formData.get("reset_token")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}
