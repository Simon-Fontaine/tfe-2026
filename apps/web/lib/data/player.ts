import type {
	AvailabilityRow,
	PlayerProfileFull,
	PlayerStats,
	PublicPlayerDetail,
	PublicPlayerSummary,
	UserTeam,
} from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type {
	AvailabilityRow,
	PlayerProfileFull,
	PlayerStats,
	PublicPlayerDetail,
	PublicPlayerSummary,
	UserTeam,
};

export const getPlayerProfileFull = cache(
	async (_userId: string): Promise<PlayerProfileFull | null> => {
		const res = await apiGet<PlayerProfileFull | null>(apiRoutes.profile.root);
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export const getPlayerStats = cache(async (_userId: string): Promise<PlayerStats> => {
	const res = await apiGet<PlayerStats>(apiRoutes.profile.stats);
	if ("data" in res) return res.data;
	if (res.status === 404) return { topTeamRating: null, scrimsPlayed: 0, wins: 0 };
	throw new Error(res.error);
});

export const getPlayerAvailability = cache(
	async (_userId: string, teamId: string): Promise<AvailabilityRow[]> => {
		const res = await apiGet<AvailabilityRow[]>(
			`${apiRoutes.schedule.availability.root}?teamId=${encodeURIComponent(teamId)}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getActiveTeamsForUser = cache(async (_userId: string): Promise<UserTeam[]> => {
	const res = await apiGet<UserTeam[]>(apiRoutes.schedule.teams);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getPublicPlayers = cache(async (): Promise<PublicPlayerSummary[]> => {
	const res = await apiGet<PublicPlayerSummary[]>(apiRoutes.players.publicRoot);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getPublicPlayerByUsername = cache(
	async (username: string): Promise<PublicPlayerDetail | null> => {
		const res = await apiGet<PublicPlayerDetail>(apiRoutes.players.publicByUsername(username));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);
