"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";

export async function addPlayerAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost(`/api/teams/${teamId}/roster`, {
		teamId,
		orgId: String(formData.get("orgId") ?? ""),
		userId: String(formData.get("userId") ?? ""),
		roleInTeam: String(formData.get("roleInTeam") ?? ""),
		status: String(formData.get("status") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function updateRosterStatusAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const rosterId = String(formData.get("rosterId") ?? "");
	const res = await apiPatch(`/api/teams/${teamId}/roster/${rosterId}`, {
		status: String(formData.get("status") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function removeRosterMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const rosterId = String(formData.get("rosterId") ?? "");
	const res = await apiDelete(`/api/teams/${teamId}/roster/${rosterId}`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}
