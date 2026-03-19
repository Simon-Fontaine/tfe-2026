import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
	availabilityTable,
	playerHeroTable,
	playerProfileTable,
	teamRosterTable,
} from "@/db/schema";

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

/**
 * Fetches the player's full profile including hero pool.
 * Memoized per request with React's `cache()`.
 */
export const getPlayerProfileFull = cache(
	async (userId: string): Promise<PlayerProfileFull | null> => {
		const profile = await db.query.playerProfileTable.findFirst({
			where: eq(playerProfileTable.userId, userId),
			columns: {
				battletag: true,
				primaryRole: true,
				secondaryRole: true,
				rank: true,
				rankDivision: true,
				internalSr: true,
			},
		});

		if (!profile) return null;

		const heroRows = await db.query.playerHeroTable.findMany({
			where: eq(playerHeroTable.userId, userId),
			with: {
				hero: {
					columns: {
						id: true,
						displayName: true,
						role: true,
						imageUrl: true,
					},
				},
			},
			orderBy: [asc(playerHeroTable.heroId)],
		});

		return {
			battletag: profile.battletag,
			primaryRole: profile.primaryRole,
			secondaryRole: profile.secondaryRole ?? null,
			rank: profile.rank ?? null,
			rankDivision: profile.rankDivision ?? null,
			internalSr: profile.internalSr,
			heroes: heroRows.map((row) => row.hero),
		};
	}
);

/**
 * Fetches stats summary for the player. Scrim counts are 0 until Phase 3.
 * Memoized per request with React's `cache()`.
 */
export const getPlayerStats = cache(async (userId: string): Promise<PlayerStats> => {
	const profile = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, userId),
		columns: { internalSr: true },
	});

	return {
		sr: profile?.internalSr ?? 1500,
		scrimsPlayed: 0,
		wins: 0,
	};
});

/**
 * Fetches a player's availability windows for a specific team.
 * Memoized per request with React's `cache()`.
 */
export const getPlayerAvailability = cache(
	async (userId: string, teamId: string): Promise<AvailabilityRow[]> => {
		return db.query.availabilityTable.findMany({
			where: and(eq(availabilityTable.userId, userId), eq(availabilityTable.teamId, teamId)),
			columns: {
				id: true,
				teamId: true,
				dayOfWeek: true,
				specificDate: true,
				startTime: true,
				endTime: true,
				timezone: true,
				label: true,
			},
			orderBy: [asc(availabilityTable.dayOfWeek), asc(availabilityTable.specificDate)],
		});
	}
);

/**
 * Fetches all teams where the user is an active roster member.
 * Memoized per request with React's `cache()`.
 */
export const getActiveTeamsForUser = cache(async (userId: string): Promise<UserTeam[]> => {
	const rows = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.userId, userId), eq(teamRosterTable.status, "active")),
		with: {
			team: {
				columns: { id: true, name: true, tag: true },
			},
		},
	});
	return rows.map((r) => r.team);
});

/**
 * Checks whether a user is an active member of a team.
 * Not memoized — used inside Server Actions outside the render cycle.
 */
export async function verifyUserOnTeam(userId: string, teamId: string): Promise<boolean> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(
			eq(teamRosterTable.userId, userId),
			eq(teamRosterTable.teamId, teamId),
			eq(teamRosterTable.status, "active")
		),
		columns: { id: true },
	});
	return row !== undefined;
}
