"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";

export async function sendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost(`/api/teams/${teamId}/invites`, {
		orgId: String(formData.get("orgId") ?? ""),
		teamId,
		userId: String(formData.get("userId") ?? ""),
		roleInTeam: String(formData.get("roleInTeam") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function cancelTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiDelete(`/api/teams/${teamId}/invites/${inviteId}`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function respondToTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const res = await apiPost(`/api/teams/invites/${inviteId}/respond`, {
		action: String(formData.get("action") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/invitations");
	revalidatePath("/dashboard/teams");
	return { success: true };
}
