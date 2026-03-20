import { cache } from "react";

import { apiGet } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RosterStatus = "active" | "benched" | "trial" | "inactive";
export type OW2Role = "tank" | "damage" | "support";

export type RosterMember = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	primaryRole: OW2Role;
	rank: string | null;
	rankDivision: number | null;
	roleInTeam: OW2Role;
	status: RosterStatus;
	joinedAt: Date;
};

export type TeamWithRoster = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	roster: RosterMember[];
};

export type UserSearchResult = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	primaryRole: OW2Role | null;
	rank: string | null;
};

export type TeamInviteSummary = {
	id: string;
	teamId: string;
	teamName: string;
	teamTag: string;
	teamAvatarUrl: string | null;
	inviterDisplayName: string;
	roleInTeam: OW2Role;
	expiresAt: Date;
	createdAt: Date;
};

export type TeamPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	roleInTeam: OW2Role;
	expiresAt: Date;
	createdAt: Date;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getTeamWithRoster = cache(
	async (teamId: string, _userId: string): Promise<TeamWithRoster | null> => {
		const res = await apiGet<TeamWithRoster>(`/api/teams/${teamId}`);
		if ("data" in res) return res.data;
		return null;
	}
);

export async function getPendingTeamInvitesForUser(_userId: string): Promise<TeamInviteSummary[]> {
	const res = await apiGet<TeamInviteSummary[]>("/api/teams/invites/received");
	if ("data" in res) return res.data;
	return [];
}

export async function getTeamPendingInvites(
	teamId: string,
	_userId: string
): Promise<TeamPendingInvite[]> {
	const res = await apiGet<TeamPendingInvite[]>(`/api/teams/${teamId}/invites`);
	if ("data" in res) return res.data;
	return [];
}
