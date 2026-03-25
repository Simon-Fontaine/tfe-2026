import type { TeamPublicPreview } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { lfgPostTable, teamJoinRequestTable, teamRosterTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";

const publicTeamRoutes = new Hono<AuthEnv>();

publicTeamRoutes.use("*", optionalAuth);

// GET /:id — Public team preview with safe fields only
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
		},
	});

	if (!team) return c.json({ error: "Team not found." }, 404);

	const openLfgPost = await db.query.lfgPostTable.findFirst({
		where: and(eq(lfgPostTable.teamId, teamId), eq(lfgPostTable.status, "open")),
		columns: { id: true },
	});
	const hasPendingJoinRequest = user
		? Boolean(
				await db.query.teamJoinRequestTable.findFirst({
					where: and(
						eq(teamJoinRequestTable.teamId, teamId),
						eq(teamJoinRequestTable.requesterUserId, user.id),
						eq(teamJoinRequestTable.status, "pending")
					),
					columns: { id: true },
				})
			)
		: false;

	const data: TeamPublicPreview = {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: team.organization?.name ?? "Organisation",
		organizationSlug: team.organization?.slug ?? "",
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount: team.roster.length,
		hasOpenRolePost: Boolean(openLfgPost),
		hasPendingJoinRequest,
	};

	return c.json({ data });
});

export { publicTeamRoutes };
