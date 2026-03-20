import { cache } from "react";

import { apiGet } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PlayerProfileFull = {
	battletag: string | null;
	primaryRole: "tank" | "damage" | "support";
	secondaryRole: "tank" | "damage" | "support" | null;
	rank: string | null;
	rankDivision: number | null;
	internalSr: number;
	heroes: {
		id: string;
		displayName: string;
		role: "tank" | "damage" | "support";
		imageUrl: string | null;
	}[];
};

export type PlayerStats = {
	sr: number;
	scrimsPlayed: number;
	wins: number;
};

export type AvailabilityRow = {
	id: string;
	teamId: string;
	dayOfWeek: number | null;
	specificDate: Date | null;
	startTime: string;
	endTime: string;
	timezone: string;
	label: string | null;
};

export type UserTeam = {
	id: string;
	name: string;
	tag: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getPlayerProfileFull = cache(
	async (_userId: string): Promise<PlayerProfileFull | null> => {
		const res = await apiGet<PlayerProfileFull | null>("/api/profile");
		if ("data" in res) return res.data;
		return null;
	}
);

export const getPlayerStats = cache(async (_userId: string): Promise<PlayerStats> => {
	const res = await apiGet<PlayerStats>("/api/profile/stats");
	if ("data" in res) return res.data;
	return { sr: 1500, scrimsPlayed: 0, wins: 0 };
});

export const getPlayerAvailability = cache(
	async (_userId: string, teamId: string): Promise<AvailabilityRow[]> => {
		const res = await apiGet<AvailabilityRow[]>(
			`/api/schedule/availability?teamId=${encodeURIComponent(teamId)}`
		);
		if ("data" in res) return res.data;
		return [];
	}
);

export const getActiveTeamsForUser = cache(async (_userId: string): Promise<UserTeam[]> => {
	const res = await apiGet<UserTeam[]>("/api/schedule/teams");
	if ("data" in res) return res.data;
	return [];
});
