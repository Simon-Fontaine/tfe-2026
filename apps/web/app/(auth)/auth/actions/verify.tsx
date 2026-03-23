"use server";

import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";

export async function verifyEmailAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/verify/email", {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}

export async function verifyNewDeviceAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/verify/device", {
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}

export async function resendVerificationAction(): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/verify/resend");
	if ("error" in res) return { error: res.error };
	return {};
}
