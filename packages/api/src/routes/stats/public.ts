import { count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { recruitmentListingTable, teamTable } from "@/db/schema";

const publicStatsRoutes = new Hono();

publicStatsRoutes.get("/", async (c) => {
	const [teamCountResult, scrimsResult, listingCountResult] = await Promise.all([
		db.select({ value: count() }).from(teamTable).where(eq(teamTable.isArchived, false)),
		db
			.select({ total: sql<number>`coalesce(sum(${teamTable.matchesPlayed}), 0)::int` })
			.from(teamTable)
			.where(eq(teamTable.isArchived, false)),
		db
			.select({ value: count() })
			.from(recruitmentListingTable)
			.where(eq(recruitmentListingTable.status, "open")),
	]);

	const data = {
		teamCount: Number(teamCountResult[0]?.value ?? 0),
		scrimsPlayed: Number(scrimsResult[0]?.total ?? 0),
		openListingCount: Number(listingCountResult[0]?.value ?? 0),
	};

	return c.json({ data });
});

export { publicStatsRoutes };
