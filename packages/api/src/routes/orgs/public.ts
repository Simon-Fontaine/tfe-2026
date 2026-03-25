import type { PublicOrgDetail, PublicOrgSummary } from "@scrimflow/shared";
import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { lfgPostTable, organizationTable, teamRosterTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { mapRecruitmentPost } from "@/utils/recruit";

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
			lfgPosts: {
				where: eq(lfgPostTable.status, "open"),
				columns: { id: true },
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
		openPostCount: row.lfgPosts.length,
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
					organizationId: true,
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
			lfgPosts: {
				where: eq(lfgPostTable.status, "open"),
				with: {
					user: { columns: { id: true, displayName: true, avatarUrl: true } },
					organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
					team: { columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true } },
					applications: { columns: { id: true, status: true, applicantUserId: true } },
				},
			},
		},
	});

	if (!org) return c.json({ error: "Organisation not found." }, 404);

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
			organizationName: org.name,
			organizationSlug: org.slug,
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
		openPosts: org.lfgPosts.map((post) => mapRecruitmentPost(post, { viewerId: user?.id ?? null })),
		hasPendingJoinRequest: false,
	};

	return c.json({ data });
});

export { publicOrgRoutes };
