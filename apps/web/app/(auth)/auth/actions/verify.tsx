"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";
import { toAuthActionResult } from "./utils";

export async function verifyEmailAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>(apiRoutes.auth.verify.email, {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	return toAuthActionResult(res);
}

export async function verifyNewDeviceAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>(apiRoutes.auth.verify.device, {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	return toAuthActionResult(res);
}

export async function resendVerificationAction(): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>(apiRoutes.auth.verify.resend);
	return toAuthActionResult(res);
}
