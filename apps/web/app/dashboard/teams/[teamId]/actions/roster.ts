"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { apiRoutes, dashboardRoutes } from "@/lib/routes";

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

export async function addPlayerAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const res = await apiPost(apiRoutes.teams.roster.root(teamId), {
		teamId,
		orgId,
		userId: String(formData.get("userId") ?? ""),
		roleInTeam: String(formData.get("roleInTeam") ?? ""),
		status: String(formData.get("status") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function updateRosterStatusAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const rosterId = String(formData.get("rosterId") ?? "");
	const res = await apiPatch(apiRoutes.teams.roster.byId(teamId, rosterId), {
		status: String(formData.get("status") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	const orgId = await getVerifiedTeamOrgId(teamId);
	if (orgId) revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function removeRosterMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const rosterId = String(formData.get("rosterId") ?? "");
	const res = await apiDelete(apiRoutes.teams.roster.byId(teamId, rosterId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	const orgId = await getVerifiedTeamOrgId(teamId);
	if (orgId) revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}
