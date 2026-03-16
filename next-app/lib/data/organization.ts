import { and, eq, gt } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { organizationMemberTable, organizationTable, orgInviteTable, teamTable } from "@/db/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrgRole = "owner" | "manager" | "coach" | "analyst" | "player";

export type UserOrg = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	description: string | null;
	role: OrgRole;
	teamCount: number;
};

export type OrgTeamSummary = {
	id: string;
	name: string;
	tag: string;
	avatarUrl: string | null;
	teamSr: number;
	isRecruiting: boolean;
};

export type OrgMemberSummary = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	role: OrgRole;
};

export type OrgWithTeams = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	description: string | null;
	ownerId: string;
	teams: OrgTeamSummary[];
	members: OrgMemberSummary[];
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetches all orgs where the user is a member, with role and team count.
 * Memoized per request with React's `cache()`.
 */
export const getOrgsForUser = cache(async (userId: string): Promise<UserOrg[]> => {
	const rows = await db.query.organizationMemberTable.findMany({
		where: eq(organizationMemberTable.userId, userId),
		with: {
			organization: {
				columns: {
					id: true,
					name: true,
					slug: true,
					avatarUrl: true,
					description: true,
				},
				with: {
					teams: {
						columns: { id: true },
						where: eq(teamTable.isArchived, false),
					},
				},
			},
		},
	});

	return rows.map((row) => ({
		id: row.organization.id,
		name: row.organization.name,
		slug: row.organization.slug,
		avatarUrl: row.organization.avatarUrl,
		description: row.organization.description ?? null,
		role: row.role as OrgRole,
		teamCount: row.organization.teams.length,
	}));
});

/**
 * Fetches a single org with its teams and members.
 * Returns null if the org doesn't exist or the user is not a member.
 * Memoized per request with React's `cache()`.
 */
export const getOrgWithTeams = cache(
	async (orgId: string, userId: string): Promise<OrgWithTeams | null> => {
		const membership = await getUserOrgRole(orgId, userId);
		if (!membership) return null;

		const org = await db.query.organizationTable.findFirst({
			where: eq(organizationTable.id, orgId),
			columns: {
				id: true,
				name: true,
				slug: true,
				avatarUrl: true,
				bannerUrl: true,
				description: true,
				ownerId: true,
			},
			with: {
				teams: {
					where: eq(teamTable.isArchived, false),
					columns: {
						id: true,
						name: true,
						tag: true,
						avatarUrl: true,
						teamSr: true,
						isRecruiting: true,
					},
				},
				members: {
					with: {
						user: {
							columns: {
								id: true,
								displayName: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});

		if (!org) return null;

		return {
			id: org.id,
			name: org.name,
			slug: org.slug,
			avatarUrl: org.avatarUrl,
			bannerUrl: org.bannerUrl ?? null,
			description: org.description ?? null,
			ownerId: org.ownerId,
			teams: org.teams,
			members: org.members.map((m) => ({
				id: m.id,
				userId: m.user.id,
				displayName: m.user.displayName,
				avatarUrl: m.user.avatarUrl,
				role: m.role as OrgRole,
			})),
		};
	}
);

/**
 * Returns the user's role in the given org, or null if not a member.
 * Not memoized — used inside Server Actions outside the render cycle.
 */
export async function getUserOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
	const row = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: { role: true },
	});
	return row ? (row.role as OrgRole) : null;
}

/**
 * Checks whether a user has management-level access to an org (owner or manager).
 * Not memoized — used inside Server Actions.
 */
export async function verifyOrgManager(orgId: string, userId: string): Promise<boolean> {
	const role = await getUserOrgRole(orgId, userId);
	return role === "owner" || role === "manager";
}

// ─── Invite types ───────────────────────────────────────────────────────────

export type OrgInviteSummary = {
	id: string;
	organizationId: string;
	orgName: string;
	orgAvatarUrl: string | null;
	inviterDisplayName: string;
	role: OrgRole;
	expiresAt: Date;
	createdAt: Date;
};

export type OrgPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	role: OrgRole;
	expiresAt: Date;
	createdAt: Date;
};

// ─── Invite queries ─────────────────────────────────────────────────────────

/**
 * Returns pending org invites addressed to the given user that have not expired.
 * Not memoized — called from the invites page server component.
 */
export async function getPendingOrgInvitesForUser(userId: string): Promise<OrgInviteSummary[]> {
	const now = new Date();
	const rows = await db.query.orgInviteTable.findMany({
		where: and(
			eq(orgInviteTable.inviteeUserId, userId),
			eq(orgInviteTable.status, "pending"),
			gt(orgInviteTable.expiresAt, now)
		),
		with: {
			organization: { columns: { id: true, name: true, avatarUrl: true } },
			inviter: { columns: { displayName: true } },
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		organizationId: r.organization.id,
		orgName: r.organization.name,
		orgAvatarUrl: r.organization.avatarUrl,
		inviterDisplayName: r.inviter.displayName,
		role: r.role as OrgRole,
		expiresAt: r.expiresAt,
		createdAt: r.createdAt,
	}));
}

/**
 * Returns pending invites sent by an org (for managers to review).
 * Not memoized — called from the org detail page.
 */
export async function getOrgPendingInvites(
	orgId: string,
	userId: string
): Promise<OrgPendingInvite[]> {
	const isManager = await verifyOrgManager(orgId, userId);
	if (!isManager) return [];

	const now = new Date();
	const rows = await db.query.orgInviteTable.findMany({
		where: and(
			eq(orgInviteTable.organizationId, orgId),
			eq(orgInviteTable.status, "pending"),
			gt(orgInviteTable.expiresAt, now)
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
		role: r.role as OrgRole,
		expiresAt: r.expiresAt,
		createdAt: r.createdAt,
	}));
}
