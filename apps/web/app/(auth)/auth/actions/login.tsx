"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";
import { toAuthActionResult } from "./utils";

export async function loginAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const result = await apiAuthPost<ActionResult>(apiRoutes.auth.login, {
		email: String(formData.get("email") ?? ""),
		password: String(formData.get("password") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	return toAuthActionResult(result);
}
