"use server";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import type { ActionResult } from "./password";

export interface DeletionStatus {
	status: "none" | "pending" | "cancelled" | "failed";
	isPending: boolean;
	scheduledAt: string | null;
	cancelledAt: string | null;
	failedAt: string | null;
}

export async function getAccountDeletionStatusAction(): Promise<DeletionStatus> {
	const res = await apiGet<DeletionStatus>(apiRoutes.settings.account.deletion.root);
	if ("data" in res) return res.data;
	return { status: "none", isPending: false, scheduledAt: null, cancelledAt: null, failedAt: null };
}

export async function requestAccountDeletionAction(reason?: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.account.deletion.request, { reason });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmAccountDeletionAction(code: string): Promise<ActionResult> {
	const res = await apiPost(apiRoutes.settings.account.deletion.confirm, { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelAccountDeletionAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.account.deletion.root);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
