import type { InviteLifecycleStatus, OrgRole } from "./types";

export function canManageOrg(role: OrgRole | null | undefined): boolean {
	return role === "owner" || role === "manager";
}

export function canDeleteOrg(role: OrgRole | null | undefined): boolean {
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

export function canRespondToInvite(
	status: InviteLifecycleStatus,
	expiresAt: string | Date
): boolean {
	if (status !== "pending") return false;
	const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	return expiry.getTime() > Date.now();
}
