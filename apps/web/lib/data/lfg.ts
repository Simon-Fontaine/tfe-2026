import { cache } from "react";

import { apiGet } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LfgPostSummary = {
	id: string;
	type: "team_seeking_player" | "player_seeking_team";
	status: string;
	rolesNeeded: string[];
	minRank: string | null;
	maxRank: string | null;
	description: string | null;
	region: string | null;
	expiresAt: Date | null;
	createdAt: Date;
	userId: string;
	userDisplayName: string;
	userAvatarUrl: string | null;
	teamId: string | null;
	teamName: string | null;
	teamTag: string | null;
	teamAvatarUrl: string | null;
	teamSr: number | null;
};

export type LfgApplicationSummary = {
	id: string;
	postId: string;
	status: string;
	message: string | null;
	createdAt: Date;
	applicantUserId: string;
	applicantDisplayName: string;
	applicantAvatarUrl: string | null;
	applicantPrimaryRole: string | null;
	applicantRank: string | null;
};

export type UserApplicationSummary = {
	id: string;
	status: string;
	message: string | null;
	createdAt: Date;
	postId: string;
	teamName: string | null;
	teamTag: string | null;
};

export type LfgFilters = {
	type?: "team_seeking_player" | "player_seeking_team";
	role?: string;
	region?: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getOpenLfgPosts = cache(
	async (filters: LfgFilters = {}): Promise<LfgPostSummary[]> => {
		const params = new URLSearchParams();
		if (filters.type) params.set("type", filters.type);
		if (filters.role) params.set("role", filters.role);
		if (filters.region) params.set("region", filters.region);
		const qs = params.toString();
		const res = await apiGet<LfgPostSummary[]>(`/api/lfg${qs ? `?${qs}` : ""}`);
		if ("data" in res) return res.data;
		return [];
	}
);

export async function getTeamApplications(teamId: string): Promise<LfgApplicationSummary[]> {
	const res = await apiGet<LfgApplicationSummary[]>(`/api/teams/${teamId}/applications`);
	if ("data" in res) return res.data;
	return [];
}

export const getUserApplications = cache(
	async (_userId: string): Promise<UserApplicationSummary[]> => {
		const res = await apiGet<UserApplicationSummary[]>("/api/lfg/applications");
		if ("data" in res) return res.data;
		return [];
	}
);

export async function getLfgPostsForTeam(teamId: string) {
	const res = await apiGet<LfgPostSummary[]>(`/api/teams/${teamId}/lfg`);
	if ("data" in res) return res.data;
	return [];
}
