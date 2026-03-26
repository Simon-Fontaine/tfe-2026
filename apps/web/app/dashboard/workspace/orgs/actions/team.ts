"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

type TeamMemberType = "player" | "staff";
type TeamStaffRole = "coach" | "analyst" | "manager" | "staff";
type TeamGameRole = "tank" | "damage" | "support";

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

function getTeamMemberFields(formData: FormData) {
	const explicitMemberType = formData.get("memberType")?.toString();
	const rawGameRole =
		formData.get("gameRole")?.toString() || formData.get("roleInTeam")?.toString();
	const rawStaffRole = formData.get("staffRole")?.toString();
	const memberType: TeamMemberType | undefined =
		explicitMemberType === "player" || explicitMemberType === "staff"
			? explicitMemberType
			: rawStaffRole
				? "staff"
				: rawGameRole
					? "player"
					: undefined;

	return {
		memberType,
		roleInTeam: memberType === "staff" ? undefined : rawGameRole || undefined,
		gameRole: memberType === "staff" ? undefined : (rawGameRole as TeamGameRole | undefined),
		staffRole: memberType === "player" ? undefined : (rawStaffRole as TeamStaffRole | undefined),
		permissionRole: formData.get("permissionRole")?.toString() || undefined,
		status: formData.get("status")?.toString() || undefined,
	};
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
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
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
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(`/teams/${teamId}`);
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
	const result = await sdk.teams.toggleRecruiting({ teamId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(`/teams/${teamId}`);
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
	const result = await sdk.teams.archive({ teamId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(`/teams/${teamId}`);
	return { success: true };
}

export async function unarchiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.unarchive({ teamId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(`/teams/${teamId}`);
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
	const result = await sdk.teams.delete({ teamId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	redirect(dashboardRoutes.workspace.orgById(orgId));
}

export async function leaveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.leave({ teamId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(`/teams/${teamId}`);
	return { success: true };
}

export async function addPlayerAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const fields = getTeamMemberFields(formData);
	const result = await sdk.teams.addMember({
		teamId,
		userId: String(formData.get("userId") ?? ""),
		memberType: fields.memberType,
		roleInTeam: fields.roleInTeam,
		gameRole: fields.gameRole,
		staffRole: fields.staffRole,
		status: fields.status ?? "active",
		permissionRole: fields.permissionRole,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function updateRosterStatusAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const memberId = String(formData.get("rosterId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.updateMember({
		teamId,
		memberId,
		status: String(formData.get("status") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function updateTeamMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const memberId = String(formData.get("memberId") ?? formData.get("rosterId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const fields = getTeamMemberFields(formData);
	const result = await sdk.teams.updateMember({
		teamId,
		memberId,
		memberType: fields.memberType,
		roleInTeam: fields.roleInTeam,
		gameRole: fields.gameRole,
		staffRole: fields.staffRole,
		status: fields.status,
		permissionRole: fields.permissionRole,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function updateTeamMemberPermissionAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const memberId = String(formData.get("memberId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.updateMemberPermission({
		teamId,
		memberId,
		permissionRole: String(formData.get("permissionRole") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function removeRosterMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const memberId = String(formData.get("rosterId") ?? formData.get("memberId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.removeMember({ teamId, memberId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function sendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const fields = getTeamMemberFields(formData);
	const result = await sdk.teams.invite({
		teamId,
		userId: String(formData.get("userId") ?? ""),
		memberType: fields.memberType,
		roleInTeam: fields.roleInTeam,
		gameRole: fields.gameRole,
		staffRole: fields.staffRole,
		permissionRole: fields.permissionRole,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function cancelTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.cancelInvite({ teamId, inviteId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}

export async function respondToTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.teams.respondToInvite({
		inviteId: String(formData.get("inviteId") ?? ""),
		action: String(formData.get("action") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.recruit.invitations);
	revalidatePath(dashboardRoutes.workspace.orgs);
	return { success: true };
}

export async function resendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const sdk = getServerSdk();
	const result = await sdk.teams.resendInvite({ teamId, inviteId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
	return { success: true };
}
