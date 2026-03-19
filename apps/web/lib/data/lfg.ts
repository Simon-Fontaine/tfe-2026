import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { lfgApplicationTable, lfgPostTable, teamRosterTable } from "@/db/schema";

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
	// Author info
	userId: string;
	userDisplayName: string;
	userAvatarUrl: string | null;
	// Team info (team_seeking_player only)
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

// ─── Queries ───────────────────────────────────────────────────────────────────

export type LfgFilters = {
	type?: "team_seeking_player" | "player_seeking_team";
	role?: string;
	region?: string;
};

/**
 * Returns open, non-expired LFG posts with optional filtering.
 * Memoized per request.
 */
export const getOpenLfgPosts = cache(
	async (filters: LfgFilters = {}): Promise<LfgPostSummary[]> => {
		const rows = await db.query.lfgPostTable.findMany({
			where: and(
				eq(lfgPostTable.status, "open"),
				filters.type ? eq(lfgPostTable.type, filters.type) : undefined
			),
			with: {
				user: { columns: { id: true, displayName: true, avatarUrl: true } },
				team: { columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true } },
			},
			orderBy: [desc(lfgPostTable.createdAt)],
			limit: 50,
		});

		return rows
			.filter((r) => {
				if (filters.role && !r.rolesNeeded.includes(filters.role)) return false;
				if (filters.region && r.region !== filters.region) return false;
				return true;
			})
			.map((r) => ({
				id: r.id,
				type: r.type,
				status: r.status,
				rolesNeeded: (r.rolesNeeded as string[]) ?? [],
				minRank: r.minRank ?? null,
				maxRank: r.maxRank ?? null,
				description: r.description ?? null,
				region: r.region ?? null,
				expiresAt: r.expiresAt ?? null,
				createdAt: r.createdAt,
				userId: r.user.id,
				userDisplayName: r.user.displayName,
				userAvatarUrl: r.user.avatarUrl,
				teamId: r.team?.id ?? null,
				teamName: r.team?.name ?? null,
				teamTag: r.team?.tag ?? null,
				teamAvatarUrl: r.team?.avatarUrl ?? null,
				teamSr: r.team?.teamSr ?? null,
			}));
	}
);

/**
 * Returns pending applications for all open LFG posts belonging to a team.
 * Not memoized — called from the team management page.
 */
export async function getTeamApplications(teamId: string): Promise<LfgApplicationSummary[]> {
	const posts = await db.query.lfgPostTable.findMany({
		where: and(eq(lfgPostTable.teamId, teamId), eq(lfgPostTable.status, "open")),
		columns: { id: true },
	});

	if (posts.length === 0) return [];

	const postIds = posts.map((p) => p.id);

	const rows = await db.query.lfgApplicationTable.findMany({
		where: and(eq(lfgApplicationTable.status, "pending")),
		with: {
			post: { columns: { id: true } },
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: { profile: { columns: { primaryRole: true, rank: true } } },
			},
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
	});

	return rows
		.filter((r) => postIds.includes(r.postId))
		.map((r) => ({
			id: r.id,
			postId: r.postId,
			status: r.status,
			message: r.message ?? null,
			createdAt: r.createdAt,
			applicantUserId: r.applicant.id,
			applicantDisplayName: r.applicant.displayName,
			applicantAvatarUrl: r.applicant.avatarUrl,
			applicantPrimaryRole: r.applicant.profile?.primaryRole ?? null,
			applicantRank: r.applicant.profile?.rank ?? null,
		}));
}

/**
 * Returns a user's own LFG applications (all statuses, newest first).
 * Memoized per request.
 */
export const getUserApplications = cache(
	async (userId: string): Promise<UserApplicationSummary[]> => {
		const rows = await db.query.lfgApplicationTable.findMany({
			where: eq(lfgApplicationTable.applicantUserId, userId),
			with: {
				post: {
					columns: { id: true },
					with: {
						team: { columns: { name: true, tag: true } },
					},
				},
			},
			orderBy: [desc(lfgApplicationTable.createdAt)],
			limit: 30,
		});

		return rows.map((r) => ({
			id: r.id,
			status: r.status,
			message: r.message ?? null,
			createdAt: r.createdAt,
			postId: r.postId,
			teamName: r.post.team?.name ?? null,
			teamTag: r.post.team?.tag ?? null,
		}));
	}
);

/**
 * Returns all LFG posts created for a specific team (any status).
 * Not memoized — called from the team management page.
 */
export async function getLfgPostsForTeam(teamId: string) {
	return db.query.lfgPostTable.findMany({
		where: eq(lfgPostTable.teamId, teamId),
		orderBy: [desc(lfgPostTable.createdAt)],
	});
}

/**
 * Checks whether a user is already an active/trial/benched member of a team.
 * Used to guard against self-applying.
 */
export async function isUserOnTeam(userId: string, teamId: string): Promise<boolean> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { status: true },
	});
	return !!row && row.status !== "inactive";
}
