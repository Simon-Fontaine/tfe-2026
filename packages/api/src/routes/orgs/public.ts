import type { PublicOrgDetail, PublicOrgSummary } from "@scrimflow/shared";
import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import {
	organizationMemberTable,
	organizationTable,
	orgJoinRequestTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";

const publicOrgRoutes = new Hono<AuthEnv>();

publicOrgRoutes.use("*", optionalAuth);

publicOrgRoutes.get("/", async (c) => {
	const rows = await db.query.organizationTable.findMany({
		columns: {
			id: true,
			slug: true,
			name: true,
			avatarUrl: true,
			description: true,
		},
		with: {
			teams: {
				where: eq(teamTable.isArchived, false),
				columns: { id: true },
				with: {
					roster: {
						where: eq(teamRosterTable.status, "active"),
						columns: { id: true },
					},
				},
			},
		},
		orderBy: [asc(organizationTable.name)],
		limit: 100,
	});

	const data: PublicOrgSummary[] = rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		name: row.name,
		avatarUrl: row.avatarUrl,
		description: row.description ?? null,
		teamCount: row.teams.length,
		activeRosterCount: row.teams.reduce((sum, team) => sum + team.roster.length, 0),
	}));

	return c.json({ data });
});

publicOrgRoutes.get("/:id", async (c) => {
	const idOrSlug = c.req.param("id");
	const user = c.get("user");

	const org = await db.query.organizationTable.findFirst({
		where: or(eq(organizationTable.id, idOrSlug), eq(organizationTable.slug, idOrSlug)),
		columns: {
			id: true,
			slug: true,
			name: true,
			avatarUrl: true,
			bannerUrl: true,
			description: true,
		},
		with: {
			teams: {
				where: and(eq(teamTable.isArchived, false)),
				columns: {
					id: true,
					name: true,
					tag: true,
					description: true,
					avatarUrl: true,
					teamSr: true,
					matchesPlayed: true,
					isRecruiting: true,
					isArchived: true,
				},
				with: {
					roster: {
						columns: { id: true, userId: true, permissionRole: true, status: true },
					},
				},
				orderBy: [asc(teamTable.name)],
			},
		},
	});

	if (!org) return c.json({ error: "Organisation not found." }, 404);

	const hasPendingJoinRequest = user
		? Boolean(
				await db.query.orgJoinRequestTable.findFirst({
					where: and(
						eq(orgJoinRequestTable.organizationId, org.id),
						eq(orgJoinRequestTable.requesterUserId, user.id),
						eq(orgJoinRequestTable.status, "pending")
					),
					columns: { id: true },
				})
			)
		: false;
	const isMember = user
		? Boolean(
				await db.query.organizationMemberTable.findFirst({
					where: and(
						eq(organizationMemberTable.organizationId, org.id),
						eq(organizationMemberTable.userId, user.id)
					),
					columns: { id: true },
				})
			)
		: false;

	const data: PublicOrgDetail = {
		id: org.id,
		slug: org.slug,
		name: org.name,
		avatarUrl: org.avatarUrl,
		bannerUrl: org.bannerUrl ?? null,
		description: org.description ?? null,
		teamCount: org.teams.length,
		activeRosterCount: org.teams.reduce(
			(sum, team) => sum + team.roster.filter((row) => row.status !== "inactive").length,
			0
		),
		teams: org.teams.map((team) => ({
			id: team.id,
			organizationId: org.id,
			name: team.name,
			tag: team.tag,
			description: team.description ?? null,
			avatarUrl: team.avatarUrl,
			teamSr: team.teamSr,
			matchesPlayed: team.matchesPlayed,
			isRecruiting: team.isRecruiting,
			isArchived: team.isArchived,
			activeRosterCount: team.roster.filter((row) => row.status !== "inactive").length,
			adminCount: new Set(
				team.roster
					.filter((row) => row.status !== "inactive" && row.permissionRole === "admin")
					.map((row) => row.userId)
			).size,
		})),
		hasPendingJoinRequest: !isMember && hasPendingJoinRequest,
	};

	return c.json({ data });
});

export { publicOrgRoutes };
