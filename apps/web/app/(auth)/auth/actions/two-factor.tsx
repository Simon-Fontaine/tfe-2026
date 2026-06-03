"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";
import { toAuthActionResult } from "./utils";

export async function twoFactorAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const result = await apiAuthPost<ActionResult>(apiRoutes.auth.twoFactor.totp, {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	return toAuthActionResult(result);
}

export async function recoveryCodeAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const result = await apiAuthPost<ActionResult>(apiRoutes.auth.twoFactor.recovery, {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	return toAuthActionResult(result);
}
