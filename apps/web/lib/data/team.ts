import type {
	OW2Role,
	RosterMember,
	RosterStatus,
	TeamInviteSummary,
	TeamPendingInvite,
	TeamWithRoster,
	UserSearchResult,
} from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type {
	OW2Role,
	RosterMember,
	RosterStatus,
	TeamInviteSummary,
	TeamPendingInvite,
	TeamWithRoster,
	UserSearchResult,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getTeamWithRoster = cache(
	async (teamId: string, _userId: string): Promise<TeamWithRoster | null> => {
		const res = await apiGet<TeamWithRoster>(`/api/teams/${teamId}`);
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export async function getPendingTeamInvitesForUser(_userId: string): Promise<TeamInviteSummary[]> {
	const res = await apiGet<TeamInviteSummary[]>("/api/teams/invites/received");
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export async function getTeamPendingInvites(
	teamId: string,
	_userId: string
): Promise<TeamPendingInvite[]> {
	const res = await apiGet<TeamPendingInvite[]>(`/api/teams/${teamId}/invites`);
	if ("data" in res) return res.data;
	throw new Error(res.error);
}
