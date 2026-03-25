"use server";

import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import type { ActionResult } from "./types";

export async function twoFactorAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.auth.verifyTotp({
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});

	const actionResult = toActionResult(result);
	return "data" in actionResult ? (actionResult.data as ActionResult) : actionResult;
}

export async function recoveryCodeAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.auth.verifyRecoveryCode({
		code: String(formData.get("code") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});

	const actionResult = toActionResult(result);
	return "data" in actionResult ? (actionResult.data as ActionResult) : actionResult;
}
