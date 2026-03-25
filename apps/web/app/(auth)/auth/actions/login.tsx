"use server";

import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import type { ActionResult } from "./types";

export async function loginAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.auth.login({
		email: String(formData.get("email") ?? ""),
		password: String(formData.get("password") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});

	const actionResult = toActionResult(result);
	return "data" in actionResult ? (actionResult.data as ActionResult) : actionResult;
}
