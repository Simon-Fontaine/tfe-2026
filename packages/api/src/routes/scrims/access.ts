import type { ScrimConfirmationStatus } from "@scrimflow/shared";
import { createNotification } from "@/notifications";
import { verifyOrgManager } from "@/utils/org";
import { getTeamAccessContext, listTeamAdminUserIds, verifyTeamManager } from "@/utils/team";
import { TEAM_VIEWABLE_STATUSES } from "./constants";

export async function canViewTeam(teamId: string, userId: string) {
	const access = await getTeamAccessContext(teamId, userId);
	if (!access) return false;
	if (access.canManageTeam) return true;
	return access.teamStatus
		? TEAM_VIEWABLE_STATUSES.includes(access.teamStatus as (typeof TEAM_VIEWABLE_STATUSES)[number])
		: false;
}

export async function canAccessScrim(
	userId: string,
	scrim: { homeTeamId: string; awayTeamId: string | null }
) {
	if (await canViewTeam(scrim.homeTeamId, userId)) return true;
	if (scrim.awayTeamId && (await canViewTeam(scrim.awayTeamId, userId))) return true;
	return false;
}

export function resolveScrimStatus(
	confirmations: { teamId: string; status: ScrimConfirmationStatus }[],
	teamIds: string[]
) {
	const statuses = teamIds.map(
		(teamId) =>
			confirmations.find((confirmation) => confirmation.teamId === teamId)?.status ?? "pending"
	);

	if (statuses.some((status) => status === "disputed")) {
		return "disputed" as const;
	}

	if (statuses.length > 0 && statuses.every((status) => status === "confirmed")) {
		return "completed" as const;
	}

	return "awaiting_confirmation" as const;
}

export async function canManageAnyScrimTeam(
	userId: string,
	scrim: { homeTeamId: string; awayTeamId: string | null }
) {
	if (await verifyTeamManager(scrim.homeTeamId, userId)) return true;
	if (scrim.awayTeamId && (await verifyTeamManager(scrim.awayTeamId, userId))) return true;
	return false;
}

export async function canResolveScrimDispute(
	userId: string,
	scrim: {
		homeTeam: { organizationId: string };
		awayTeam: { organizationId: string } | null;
	}
) {
	if (await verifyOrgManager(scrim.homeTeam.organizationId, userId)) return true;
	if (scrim.awayTeam?.organizationId) {
		return verifyOrgManager(scrim.awayTeam.organizationId, userId);
	}
	return false;
}

export async function notifyTeamAdmins(params: {
	teamId: string;
	actorUserId: string;
	type:
		| "scrim_request"
		| "scrim_accepted"
		| "scrim_cancelled"
		| "scrim_disputed"
		| "scrim_resolved"
		| "scrim_rescheduled"
		| "scrim_started"
		| "scrim_result_reported";
	title: string;
	body: string;
	scrimId: string;
}) {
	const adminUserIds = await listTeamAdminUserIds(params.teamId);

	await Promise.all(
		adminUserIds
			.filter((userId) => userId !== params.actorUserId)
			.map((userId) =>
				createNotification({
					userId,
					type: params.type,
					title: params.title,
					body: params.body,
					referenceType: "scrim",
					referenceId: params.scrimId,
				})
			)
	);
}
