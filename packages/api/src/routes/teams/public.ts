import type { TeamPublicPreview } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { lfgPostTable, teamRosterTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { mapRecruitmentPost } from "@/utils/recruit";

const publicTeamRoutes = new Hono<AuthEnv>();

publicTeamRoutes.use("*", optionalAuth);

publicTeamRoutes.get("/:id", async (c) => {
	const teamId = c.req.param("id");
	const user = c.get("user");

	const team = await db.query.teamTable.findFirst({
		where: and(eq(teamTable.id, teamId), eq(teamTable.isArchived, false)),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			bannerUrl: true,
			teamSr: true,
			matchesPlayed: true,
			isRecruiting: true,
			isArchived: true,
		},
		with: {
			organization: {
				columns: {
					name: true,
					slug: true,
				},
			},
			roster: {
				where: eq(teamRosterTable.status, "active"),
				columns: { id: true },
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

	if (!team) return c.json({ error: "Team not found." }, 404);

	const data: TeamPublicPreview = {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: team.organization?.name ?? "Organisation",
		organizationSlug: team.organization?.slug ?? "",
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		bannerUrl: team.bannerUrl ?? null,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount: team.roster.length,
		openPostCount: team.lfgPosts.length,
		hasOpenRolePost: team.lfgPosts.length > 0,
		hasPendingJoinRequest: false,
		posts: team.lfgPosts.map((post) => mapRecruitmentPost(post, { viewerId: user?.id ?? null })),
	};

	return c.json({ data });
});

export { publicTeamRoutes };
