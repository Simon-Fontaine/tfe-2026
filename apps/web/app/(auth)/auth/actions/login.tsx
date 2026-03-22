"use server";

import { apiAuthPost } from "@/lib/api-client";
import type { ActionResult } from "./types";

export async function loginAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const res = await apiAuthPost<ActionResult>("/api/auth/login", {
		email: String(formData.get("email") ?? ""),
		password: String(formData.get("password") ?? ""),
		next: formData.get("next")?.toString() ?? "",
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	return res;
}
