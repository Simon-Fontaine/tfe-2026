"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/team";

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

export async function sendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const res = await apiPost(`/api/teams/${teamId}/invites`, {
		orgId,
		teamId,
		userId: String(formData.get("userId") ?? ""),
		roleInTeam: String(formData.get("roleInTeam") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/workspace/orgs/${orgId}/teams/${teamId}`);
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
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (orgId) revalidatePath(`/dashboard/workspace/orgs/${orgId}/teams/${teamId}`);
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

	revalidatePath("/dashboard/recruit/inbox");
	revalidatePath("/dashboard/teams");
	return { success: true };
}

export async function resendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost(`/api/teams/${teamId}/invites/${inviteId}/resend`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (orgId) revalidatePath(`/dashboard/workspace/orgs/${orgId}/teams/${teamId}`);
	return { success: true };
}
