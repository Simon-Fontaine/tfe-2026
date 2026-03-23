import { AvailabilitySchema } from "@scrimflow/shared";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { availabilityTable, teamRosterTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { verifyUserOnTeam } from "@/utils/team";

const scheduleRoutes = new Hono<AuthEnv>();

// GET /availability — Get user's availability for a team
scheduleRoutes.get("/availability", async (c) => {
	const user = c.get("user");
	const teamId = c.req.query("teamId");

	if (!teamId) return c.json({ error: "teamId query parameter is required." }, 400);

	const rows = await db.query.availabilityTable.findMany({
		where: and(eq(availabilityTable.userId, user.id), eq(availabilityTable.teamId, teamId)),
		columns: {
			id: true,
			teamId: true,
			dayOfWeek: true,
			specificDate: true,
			startTime: true,
			endTime: true,
			timezone: true,
			label: true,
		},
		orderBy: [asc(availabilityTable.dayOfWeek), asc(availabilityTable.specificDate)],
	});

	return c.json({ data: rows });
});

// GET /teams — Get user's active teams (for team selector)
scheduleRoutes.get("/teams", async (c) => {
	const user = c.get("user");

	const rows = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.userId, user.id), eq(teamRosterTable.status, "active")),
		with: {
			team: {
				columns: { id: true, name: true, tag: true },
			},
		},
	});

	return c.json({ data: rows.map((r) => r.team) });
});

// POST /availability — Add availability
scheduleRoutes.post("/availability", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(AvailabilitySchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { teamId, type, dayOfWeek, specificDate, startTime, endTime, timezone, label } =
		parsed.output;

	const onTeam = await verifyUserOnTeam(user.id, teamId);
	if (!onTeam) return c.json({ error: "You are not an active member of this team." }, 403);

	await db.insert(availabilityTable).values({
		userId: user.id,
		teamId,
		dayOfWeek: type === "recurring" ? (dayOfWeek ?? null) : null,
		specificDate: type === "one_off" && specificDate ? new Date(specificDate) : null,
		startTime,
		endTime,
		timezone,
		label: label || null,
	});

	return c.json({ success: true });
});

// DELETE /availability/:id — Delete availability
scheduleRoutes.delete("/availability/:id", async (c) => {
	const user = c.get("user");
	const id = c.req.param("id");

	const row = await db.query.availabilityTable.findFirst({
		where: eq(availabilityTable.id, id),
		columns: { userId: true, teamId: true },
	});
	if (!row) return c.json({ error: "Availability window not found." }, 404);
	if (row.userId !== user.id) return c.json({ error: "Not authorized." }, 403);

	const onTeam = await verifyUserOnTeam(user.id, row.teamId);
	if (!onTeam) return c.json({ error: "You are no longer an active member of this team." }, 403);

	await db.delete(availabilityTable).where(eq(availabilityTable.id, id));

	return c.json({ success: true });
});

export { scheduleRoutes };
