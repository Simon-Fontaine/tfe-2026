import type { InviteLifecycleStatus, OrgPermissionRole, TeamPermissionRole } from "./types";

export function canManageOrg(role: OrgPermissionRole | null | undefined): boolean {
	return role === "owner" || role === "admin";
}

export function canDeleteOrg(role: OrgPermissionRole | null | undefined): boolean {
	return role === "owner";
}

export function canTransferOrgOwnership(role: OrgPermissionRole | null | undefined): boolean {
	return role === "owner";
}

export function canAssignOrgRole(
	actorRole: OrgPermissionRole | null | undefined,
	targetRole: OrgPermissionRole
): boolean {
	if (actorRole === "owner") return true;
	if (actorRole === "admin") return targetRole === "member";
	return false;
}

export function canManageTeam(
	orgRole: OrgPermissionRole | null | undefined,
	teamPermissionRole: TeamPermissionRole | null | undefined
): boolean {
	return canManageOrg(orgRole) || teamPermissionRole === "admin";
}

/**
 * Teams have no stored owner; "ownership" is the senior team admin. Transferring it
 * (promoting another member to the team-admin/manager designation) is gated the same
 * way as managing the team — org owners/admins or an existing team admin.
 */
export function canTransferTeamOwnership(
	orgRole: OrgPermissionRole | null | undefined,
	teamPermissionRole: TeamPermissionRole | null | undefined
): boolean {
	return canManageTeam(orgRole, teamPermissionRole);
}

export function canAssignTeamAdmin(
	orgRole: OrgPermissionRole | null | undefined,
	teamPermissionRole: TeamPermissionRole | null | undefined,
	targetPermissionRole: TeamPermissionRole
): boolean {
	if (canManageOrg(orgRole)) return true;
	if (teamPermissionRole === "admin") return targetPermissionRole === "member";
	return false;
}

export function canApplyToInvite(status: InviteLifecycleStatus, expiresAt: string | Date): boolean {
	if (status !== "pending") return false;
	const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	return expiry.getTime() > Date.now();
}

export function canApplyToTeam(rosterStatus: string | null | undefined): boolean {
	return rosterStatus === "active";
}
