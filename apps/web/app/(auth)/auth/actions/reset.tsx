"use server";

import { apiAuthPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./types";
import { toAuthActionResult } from "./utils";

export async function forgotPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>(apiRoutes.auth.forgotPassword, {
		email: String(formData.get("email") ?? ""),
	});
	return toAuthActionResult(res);
}

export async function resetPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>(apiRoutes.auth.resetPassword, {
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
		reset_token: formData.get("reset_token")?.toString() ?? "",
	});
	return toAuthActionResult(res);
}
