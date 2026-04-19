import type {
	OW2Role,
	RosterMember,
	RosterStatus,
	TeamInviteSummary,
	TeamPendingInvite,
	TeamPublicPreview,
	TeamSchedule,
	TeamWithRoster,
	TeamWorkspaceDetail,
	UserSearchResult,
} from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type {
	OW2Role,
	RosterMember,
	RosterStatus,
	TeamInviteSummary,
	TeamPendingInvite,
	TeamPublicPreview,
	TeamWithRoster,
	TeamSchedule,
	TeamWorkspaceDetail,
	UserSearchResult,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getTeamWithRoster = cache(
	async (teamId: string, _userId: string): Promise<TeamWithRoster | null> => {
		const res = await apiGet<TeamWithRoster>(apiRoutes.teams.byId(teamId));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export const getPublicTeamPreview = cache(
	async (teamId: string): Promise<TeamPublicPreview | null> => {
		const res = await apiGet<TeamPublicPreview>(apiRoutes.teams.publicById(teamId));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export async function getPendingTeamInvitesForUser(_userId: string): Promise<TeamInviteSummary[]> {
	const res = await apiGet<TeamInviteSummary[]>(apiRoutes.teams.invites.received);
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export async function getTeamPendingInvites(
	teamId: string,
	_userId: string
): Promise<TeamPendingInvite[]> {
	const res = await apiGet<TeamPendingInvite[]>(apiRoutes.teams.invites.pending(teamId));
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export const getTeamSchedule = cache(async (teamId: string): Promise<TeamSchedule | null> => {
	const res = await apiGet<TeamSchedule>(apiRoutes.schedule.teamById(teamId));
	if ("data" in res) return res.data;
	if (res.status === 403) return null;
	throw new Error(res.error);
});
