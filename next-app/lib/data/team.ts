import { and, asc, eq, gt, ilike, notInArray } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
	organizationMemberTable,
	playerProfileTable,
	teamInviteTable,
	teamRosterTable,
	teamTable,
	userTable,
} from "@/db/schema";

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

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetches a team with its full roster.
 * Returns null if the team doesn't exist or the user is not an org member.
 * Memoized per request with React's `cache()`.
 */
export const getTeamWithRoster = cache(
	async (teamId: string, userId: string): Promise<TeamWithRoster | null> => {
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
			columns: {
				id: true,
				organizationId: true,
				name: true,
				tag: true,
				description: true,
				avatarUrl: true,
				teamSr: true,
				matchesPlayed: true,
				isRecruiting: true,
			},
		});

		if (!team) return null;

		// Verify user is a member of the org that owns this team.
		const orgMember = await db.query.organizationMemberTable.findFirst({
			where: and(
				eq(organizationMemberTable.organizationId, team.organizationId),
				eq(organizationMemberTable.userId, userId)
			),
			columns: { id: true },
		});
		if (!orgMember) return null;

		const rosterRows = await db.query.teamRosterTable.findMany({
			where: eq(teamRosterTable.teamId, teamId),
			with: {
				user: {
					columns: { id: true, displayName: true, avatarUrl: true },
					with: {
						profile: {
							columns: { primaryRole: true, rank: true, rankDivision: true },
						},
					},
				},
			},
			orderBy: [asc(teamRosterTable.joinedAt)],
		});

		return {
			id: team.id,
			organizationId: team.organizationId,
			name: team.name,
			tag: team.tag,
			description: team.description ?? null,
			avatarUrl: team.avatarUrl,
			teamSr: team.teamSr,
			matchesPlayed: team.matchesPlayed,
			isRecruiting: team.isRecruiting,
			roster: rosterRows.map((row) => ({
				id: row.id,
				userId: row.user.id,
				displayName: row.user.displayName,
				avatarUrl: row.user.avatarUrl,
				primaryRole: (row.user.profile?.primaryRole ?? "damage") as OW2Role,
				rank: row.user.profile?.rank ?? null,
				rankDivision: row.user.profile?.rankDivision ?? null,
				roleInTeam: row.roleInTeam as OW2Role,
				status: row.status as RosterStatus,
				joinedAt: row.joinedAt,
			})),
		};
	}
);

/**
 * Returns the user's roster row for a team, or null if not on the roster.
 * Not memoized — used inside Server Actions.
 */
export async function getUserTeamRole(
	teamId: string,
	userId: string
): Promise<{ roleInTeam: OW2Role; status: RosterStatus } | null> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { roleInTeam: true, status: true },
	});
	if (!row) return null;
	return { roleInTeam: row.roleInTeam as OW2Role, status: row.status as RosterStatus };
}

/**
 * Searches for users by display name (case-insensitive, partial match).
 * Excludes users who are already active/benched/trial members of the given team.
 * Not memoized — called from the user search Route Handler.
 */
export async function searchUsersByDisplayName(
	query: string,
	excludeTeamId?: string,
	limit = 10
): Promise<UserSearchResult[]> {
	// Collect userIds to exclude (active roster members of the target team).
	let excludedUserIds: string[] = [];
	if (excludeTeamId) {
		const activeMembers = await db.query.teamRosterTable.findMany({
			where: and(
				eq(teamRosterTable.teamId, excludeTeamId),
				notInArray(teamRosterTable.status, ["inactive"])
			),
			columns: { userId: true },
		});
		excludedUserIds = activeMembers.map((m) => m.userId);
	}

	const rows = await db
		.select({
			id: userTable.id,
			displayName: userTable.displayName,
			avatarUrl: userTable.avatarUrl,
			primaryRole: playerProfileTable.primaryRole,
			rank: playerProfileTable.rank,
		})
		.from(userTable)
		.leftJoin(playerProfileTable, eq(playerProfileTable.userId, userTable.id))
		.where(
			excludedUserIds.length > 0
				? and(ilike(userTable.displayName, `%${query}%`), notInArray(userTable.id, excludedUserIds))
				: ilike(userTable.displayName, `%${query}%`)
		)
		.limit(limit);

	return rows.map((r) => ({
		id: r.id,
		displayName: r.displayName,
		avatarUrl: r.avatarUrl,
		primaryRole: (r.primaryRole as OW2Role) ?? null,
		rank: r.rank ?? null,
	}));
}

// ─── Invite types ───────────────────────────────────────────────────────────

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

// ─── Invite queries ─────────────────────────────────────────────────────────

/**
 * Returns pending team invites addressed to the given user that have not expired.
 * Not memoized — called from the invites page server component.
 */
export async function getPendingTeamInvitesForUser(userId: string): Promise<TeamInviteSummary[]> {
	const now = new Date();
	const rows = await db.query.teamInviteTable.findMany({
		where: and(
			eq(teamInviteTable.inviteeUserId, userId),
			eq(teamInviteTable.status, "pending"),
			gt(teamInviteTable.expiresAt, now)
		),
		with: {
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true } },
			inviter: { columns: { displayName: true } },
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		teamId: r.team.id,
		teamName: r.team.name,
		teamTag: r.team.tag,
		teamAvatarUrl: r.team.avatarUrl,
		inviterDisplayName: r.inviter.displayName,
		roleInTeam: r.roleInTeam as OW2Role,
		expiresAt: r.expiresAt,
		createdAt: r.createdAt,
	}));
}

/**
 * Returns pending invites sent by a team (for managers to review/cancel).
 * Returns [] if the user is not an org manager.
 * Not memoized — called from the team detail page.
 */
export async function getTeamPendingInvites(
	teamId: string,
	userId: string
): Promise<TeamPendingInvite[]> {
	// Verify the user is an org member for this team's org.
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
	});
	if (!team) return [];

	const orgMember = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, team.organizationId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: { role: true },
	});
	if (!orgMember || (orgMember.role !== "owner" && orgMember.role !== "manager")) return [];

	const now = new Date();
	const rows = await db.query.teamInviteTable.findMany({
		where: and(
			eq(teamInviteTable.teamId, teamId),
			eq(teamInviteTable.status, "pending"),
			gt(teamInviteTable.expiresAt, now)
		),
		with: {
			invitee: { columns: { id: true, displayName: true, avatarUrl: true } },
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		inviteeUserId: r.invitee.id,
		inviteeDisplayName: r.invitee.displayName,
		inviteeAvatarUrl: r.invitee.avatarUrl,
		roleInTeam: r.roleInTeam as OW2Role,
		expiresAt: r.expiresAt,
		createdAt: r.createdAt,
	}));
}
