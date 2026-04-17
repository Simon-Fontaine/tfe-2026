"use server";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { ActionResult } from "./password";

export interface DeletionStatus {
	isPending: boolean;
	scheduledAt: string | null;
}

export async function getAccountDeletionStatusAction(): Promise<DeletionStatus> {
	const res = await apiGet<DeletionStatus>("/api/settings/account/deletion");
	if ("data" in res) return res.data;
	return { isPending: false, scheduledAt: null };
}

export async function requestAccountDeletionAction(reason?: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/account/deletion/request", { reason });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function confirmAccountDeletionAction(code: string): Promise<ActionResult> {
	const res = await apiPost("/api/settings/account/deletion/confirm", { code });
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function cancelAccountDeletionAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/account/deletion");
	if ("error" in res) return { error: res.error };
	return { success: true };
}
