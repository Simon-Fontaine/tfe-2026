"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

export async function createTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { teamId?: string }> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.create({
		orgId,
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true, teamId: actionResult.data.teamId };
}

export async function updateTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const sdk = getServerSdk();
	const result = await sdk.teams.update({
		teamId,
		orgId,
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function toggleRecruitingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const sdk = getServerSdk();
	const result = await sdk.teams.toggleRecruiting({
		teamId,
		orgId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function archiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const sdk = getServerSdk();
	const result = await sdk.teams.archive({
		teamId,
		orgId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function deleteTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };
	const sdk = getServerSdk();
	const result = await sdk.teams.delete({
		teamId,
		orgId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	redirect(dashboardRoutes.workspace.orgById(orgId));
}
