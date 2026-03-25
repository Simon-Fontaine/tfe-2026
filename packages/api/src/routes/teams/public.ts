import type { TeamPublicPreview } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { lfgPostTable, teamRosterTable, teamTable } from "@/db/schema";

const publicTeamRoutes = new Hono();

// GET /:id — Public team preview with safe fields only
publicTeamRoutes.get("/:id", async (c) => {
	const teamId = c.req.param("id");

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
		},
		with: {
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

	const data: TeamPublicPreview = {
		id: team.id,
		organizationId: team.organizationId,
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		activeRosterCount: team.roster.length,
		hasOpenRolePost: Boolean(openLfgPost),
	};

	return c.json({ data });
});

export { publicTeamRoutes };
