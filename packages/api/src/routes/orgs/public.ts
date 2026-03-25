import type { PublicOrgDetail, PublicOrgSummary } from "@scrimflow/shared";
import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { organizationTable, teamRosterTable, teamTable } from "@/db/schema";

const publicOrgRoutes = new Hono();

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
					avatarUrl: true,
					teamSr: true,
					isRecruiting: true,
				},
				with: {
					roster: {
						where: eq(teamRosterTable.status, "active"),
						columns: { id: true },
					},
				},
				orderBy: [asc(teamTable.name)],
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
		activeRosterCount: org.teams.reduce((sum, team) => sum + team.roster.length, 0),
		teams: org.teams.map((team) => ({
			id: team.id,
			name: team.name,
			tag: team.tag,
			avatarUrl: team.avatarUrl,
			teamSr: team.teamSr,
			isRecruiting: team.isRecruiting,
		})),
	};

	return c.json({ data });
});

export { publicOrgRoutes };
