"use server";

import { apiRoutes, appRoutes } from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api-client";
import type { ActionResult } from "./password";

export async function requestRecoveryCodeRegenerateAction(): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.security.recoveryCodeRegenerateRequest);
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmRecoveryCodeRegenerateAction(
	code: string
): Promise<ActionResult & { recoveryCode?: string }> {
	const res = await apiPost<{ data: { recoveryCode: string } }>(
		apiRoutes.settings.security.recoveryCodeRegenerateConfirm,
		{ code }
	);
	if ("error" in res) return { error: res.error };
	revalidatePath(appRoutes.settings.security);
	return { success: true, recoveryCode: res.data.recoveryCode };
}
