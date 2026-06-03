"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiPatch } from "@/lib/api-client";

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function changeUsernameAction(username: string): Promise<ActionResult> {
	const res = await apiPatch(apiRoutes.settings.username, { username });
	if ("error" in res) return { error: res.error };
	return { success: true };
}
