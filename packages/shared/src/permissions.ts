import type { InviteLifecycleStatus, OrgRole, TeamPermissionRole } from "./types";

export function canManageOrg(role: OrgRole | null | undefined): boolean {
	return role === "owner" || role === "manager";
}

export function canDeleteOrg(role: OrgRole | null | undefined): boolean {
	return role === "owner";
}

export function canTransferOrgOwnership(role: OrgRole | null | undefined): boolean {
	return role === "owner";
}

export function canAssignOrgRole(
	actorRole: OrgRole | null | undefined,
	targetRole: OrgRole
): boolean {
	if (actorRole === "owner") return true;
	if (actorRole === "manager") {
		return targetRole === "coach" || targetRole === "analyst" || targetRole === "player";
	}
	return false;
}

export function canManageTeam(
	orgRole: OrgRole | null | undefined,
	teamPermissionRole: TeamPermissionRole | null | undefined
): boolean {
	return canManageOrg(orgRole) || teamPermissionRole === "admin";
}

export function canAssignTeamAdmin(
	orgRole: OrgRole | null | undefined,
	teamPermissionRole: TeamPermissionRole | null | undefined,
	targetPermissionRole: TeamPermissionRole
): boolean {
	if (canManageOrg(orgRole)) return true;
	if (teamPermissionRole === "admin") return targetPermissionRole === "member";
	return false;
}

export function canRespondToInvite(
	status: InviteLifecycleStatus,
	expiresAt: string | Date
): boolean {
	if (status !== "pending") return false;
	const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	return expiry.getTime() > Date.now();
}
