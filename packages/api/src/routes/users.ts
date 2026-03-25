import { and, eq, ilike, notInArray } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { playerProfileTable, teamRosterTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";

const userRoutes = new Hono<AuthEnv>();

// GET /search?q=...&excludeTeamId=... — Search users by display name
userRoutes.get("/search", async (c) => {
	const q = c.req.query("q")?.trim() ?? "";
	const excludeTeamId = c.req.query("excludeTeamId");

	if (q.length < 2) return c.json({ data: [] });

	// Collect userIds to exclude (active roster members of the target team)
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
				? and(ilike(userTable.displayName, `%${q}%`), notInArray(userTable.id, excludedUserIds))
				: ilike(userTable.displayName, `%${q}%`)
		)
		.limit(10);

	const users = rows.map((r) => ({
		id: r.id,
		displayName: r.displayName,
		avatarUrl: r.avatarUrl,
		primaryRole: r.primaryRole ?? null,
		rank: r.rank ?? null,
	}));

	return c.json({ data: users });
});

export { userRoutes };
