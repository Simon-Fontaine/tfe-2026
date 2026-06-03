"use server";

import type { MemberType, OW2Role, StaffRole } from "@scrimflow/shared";
import { apiRoutes, appRoutes, publicRoutes } from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormActionResult } from "@/hooks/use-form-action";
import { isApiActionError, toFormActionError } from "@/lib/action-result";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getTeamWithRoster } from "@/lib/data/teams";

type TeamMemberType = MemberType;
type TeamStaffRole = StaffRole;
type TeamGameRole = OW2Role;

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const team = await getTeamWithRoster(teamId, user.id);
	return team?.organizationId ?? null;
}

async function getOrgSlug(orgId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const org = await getOrgWithTeams(orgId, user.id);
	return org?.slug ?? null;
}

function revalidateAppWorkspace() {
	revalidatePath(appRoutes.root);
	revalidatePath(appRoutes.root);
	revalidatePath(appRoutes.inbox);
	revalidatePath(appRoutes.calendar);
	revalidatePath(appRoutes.orgs.root);
}

async function revalidateOrgWorkspace(orgId: string) {
	revalidateAppWorkspace();
	revalidatePath(appRoutes.orgs.byId(orgId));
	revalidatePath(appRoutes.orgs.teams(orgId));
	revalidatePath(appRoutes.orgs.staff(orgId));
	revalidatePath(appRoutes.orgs.invites(orgId));
	revalidatePath(appRoutes.orgs.brand(orgId));
	revalidatePath(appRoutes.orgs.settings(orgId));
	revalidatePath(publicRoutes.orgs.root);

	const slug = await getOrgSlug(orgId);
	if (slug) {
		revalidatePath(publicRoutes.orgs.bySlug(slug));
	}
}

function revalidateTeamWorkspace(teamId: string) {
	revalidateAppWorkspace();
	revalidatePath(appRoutes.teams.byId(teamId));
	revalidatePath(appRoutes.teams.roster(teamId));
	revalidatePath(appRoutes.teams.calendar(teamId));
	revalidatePath(appRoutes.teams.scrims(teamId));
	revalidatePath(appRoutes.teams.recruiting(teamId));
	revalidatePath(appRoutes.teams.chat(teamId));
	revalidatePath(appRoutes.teams.updates(teamId));
	revalidatePath(appRoutes.teams.settings(teamId));
	revalidatePath(appRoutes.recruiting.root);
	revalidatePath(publicRoutes.teams.root);
	revalidatePath(publicRoutes.teams.byId(teamId));
	revalidatePath(publicRoutes.recruiting.root);
}

function revalidateInvitationSurfaces() {
	revalidateAppWorkspace();
	revalidatePath(appRoutes.recruiting.root);
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
	const result = await apiPost<{ teamId: string }>(apiRoutes.teams.root, {
		orgId,
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
		isPublic: formData.get("isPublic")?.toString() !== "false",
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrgWorkspace(orgId);
	revalidateTeamWorkspace(result.teamId);
	return { success: true, teamId: result.teamId };
}

export async function updateTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPatch(apiRoutes.teams.byId(teamId), {
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
		isPublic: formData.get("isPublic")?.toString() !== "false",
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function toggleRecruitingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPatch(apiRoutes.teams.recruiting(teamId), {});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function archiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.archive(teamId), {
		reason: formData.get("reason")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrgWorkspace(orgId);
	revalidateTeamWorkspace(teamId);
	return { success: true };
}

export async function unarchiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.unarchive(teamId), {
		reason: formData.get("reason")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function deleteTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiDelete(apiRoutes.teams.byId(teamId), {
		confirmName: formData.get("confirmName")?.toString() || undefined,
		reason: formData.get("reason")?.toString() || undefined,
		verificationCode: formData.get("verificationCode")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrgWorkspace(orgId);
	revalidatePath(publicRoutes.teams.root);
	revalidatePath(publicRoutes.teams.byId(teamId));
	redirect(appRoutes.orgs.byId(orgId));
}

export async function requestTeamDeletionCodeAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const result = await apiPost(apiRoutes.teams.requestDeletionCode(teamId), {});
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true };
}

export async function leaveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiDelete(apiRoutes.teams.leave(teamId));
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function startTeamOwnershipRecoveryAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.ownership.initiate(teamId), {
		kind: "recovery",
		reason: String(formData.get("reason") ?? ""),
		recoveryTargetUserId: formData.get("recoveryTargetUserId")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	revalidatePath(appRoutes.inbox);
	return { success: true };
}

export async function cancelTeamOwnershipWorkflowAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const workflowId = String(formData.get("workflowId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.ownership.cancel(teamId, workflowId), {
		reason: formData.get("reason")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	revalidatePath(appRoutes.inbox);
	return { success: true };
}

export async function respondTeamOwnershipWorkflowAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const workflowId = String(formData.get("workflowId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.ownership.respond(teamId, workflowId), {
		action: String(formData.get("action") ?? ""),
		reason: formData.get("reason")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	revalidatePath(appRoutes.inbox);
	return { success: true };
}

export async function resolveTeamOwnershipWorkflowAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const workflowId = String(formData.get("workflowId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const result = await apiPost(apiRoutes.teams.ownership.resolve(teamId, workflowId), {
		result: String(formData.get("result") ?? ""),
		reason: formData.get("reason")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	revalidatePath(appRoutes.inbox);
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

	const result = await apiPatch(apiRoutes.teams.roster.byId(teamId, memberId), {
		status: String(formData.get("status") ?? ""),
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
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

	const fields = getTeamMemberFields(formData);
	const result = await apiPatch(apiRoutes.teams.roster.byId(teamId, memberId), {
		memberType: fields.memberType,
		roleInTeam: fields.roleInTeam,
		gameRole: fields.gameRole,
		staffRole: fields.staffRole,
		status: fields.status,
		permissionRole: fields.permissionRole,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
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

	const result = await apiPatch(apiRoutes.teams.memberRole(teamId, memberId), {
		permissionRole: String(formData.get("permissionRole") ?? ""),
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
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

	const result = await apiDelete(apiRoutes.teams.roster.byId(teamId, memberId));
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function sendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const orgId = await getVerifiedTeamOrgId(teamId);
	if (!orgId) return { success: false, error: "Team not found" };

	const fields = getTeamMemberFields(formData);
	const result = await apiPost(apiRoutes.teams.invites.pending(teamId), {
		userId: String(formData.get("userId") ?? ""),
		memberType: fields.memberType,
		roleInTeam: fields.roleInTeam,
		gameRole: fields.gameRole,
		staffRole: fields.staffRole,
		permissionRole: fields.permissionRole,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
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

	const result = await apiDelete(apiRoutes.teams.invites.cancel(teamId, inviteId));
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}

export async function respondToTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const result = await apiPost<{ teamId?: string; organizationId?: string }>(
		apiRoutes.teams.invites.respond(inviteId),
		{
			action: String(formData.get("action") ?? ""),
		}
	);
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateInvitationSurfaces();
	if (result.teamId) revalidateTeamWorkspace(result.teamId);
	if (result.organizationId) await revalidateOrgWorkspace(result.organizationId);
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

	const result = await apiPost(apiRoutes.teams.invites.resend(teamId, inviteId));
	if (isApiActionError(result)) return toFormActionError(result);

	revalidateTeamWorkspace(teamId);
	await revalidateOrgWorkspace(orgId);
	return { success: true };
}
