type InviteStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";
type RosterStatus = "active" | "benched" | "trial" | "inactive";

export function getEffectiveInviteStatus(status: InviteStatus | string, expiresAt: Date) {
	return status === "pending" && expiresAt < new Date() ? "expired" : status;
}

export function isActivePendingInvite(status: InviteStatus | string, expiresAt: Date) {
	return getEffectiveInviteStatus(status, expiresAt) === "pending";
}

export function getRosterInviteConflictMessage(status: RosterStatus) {
	if (status === "inactive") {
		return "This user has a removed team membership history. Recover or update the existing roster row instead of sending a new invite.";
	}

	return "This user already has an active roster relationship with this team.";
}

export function shouldPersistExpiredInvite(status: InviteStatus | string, expiresAt: Date) {
	return status === "pending" && getEffectiveInviteStatus(status, expiresAt) === "expired";
}
