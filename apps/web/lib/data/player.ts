import type { AvailabilityRow, PlayerProfileFull, PlayerStats, UserTeam } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type { AvailabilityRow, PlayerProfileFull, PlayerStats, UserTeam };

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getPlayerProfileFull = cache(
	async (_userId: string): Promise<PlayerProfileFull | null> => {
		const res = await apiGet<PlayerProfileFull | null>("/api/profile");
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export const getPlayerStats = cache(async (_userId: string): Promise<PlayerStats> => {
	const res = await apiGet<PlayerStats>("/api/profile/stats");
	if ("data" in res) return res.data;
	if (res.status === 404) return { sr: 1500, scrimsPlayed: 0, wins: 0 };
	throw new Error(res.error);
});

export const getPlayerAvailability = cache(
	async (_userId: string, teamId: string): Promise<AvailabilityRow[]> => {
		const res = await apiGet<AvailabilityRow[]>(
			`/api/schedule/availability?teamId=${encodeURIComponent(teamId)}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getActiveTeamsForUser = cache(async (_userId: string): Promise<UserTeam[]> => {
	const res = await apiGet<UserTeam[]>("/api/schedule/teams");
	if ("data" in res) return res.data;
	throw new Error(res.error);
});
