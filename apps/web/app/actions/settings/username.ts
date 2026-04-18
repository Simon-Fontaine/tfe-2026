"use server";

import { apiPatch } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function changeUsernameAction(username: string): Promise<ActionResult> {
	const res = await apiPatch(apiRoutes.settings.username, { username });
	if ("error" in res) return { error: res.error };
	return { success: true };
}
