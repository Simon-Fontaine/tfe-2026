import { AddPlayerSchema, UpdateRosterStatusSchema } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { teamRosterTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { verifyOrgManager } from "@/utils/org";
import { getOrgIdForRoster } from "@/utils/team";

const rosterRoutes = new Hono<AuthEnv>();

// POST / — Add player to roster
rosterRoutes.post("/", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(AddPlayerSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { teamId, orgId, userId, roleInTeam, status } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager)
		return c.json({ error: "You do not have permission to manage this team's roster." }, 403);

	// Upsert: update if the user already has a row (including inactive), otherwise insert
	const existing = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { id: true },
	});

	if (existing) {
		await db
			.update(teamRosterTable)
			.set({ roleInTeam, status, leftAt: null })
			.where(eq(teamRosterTable.id, existing.id));
	} else {
		await db.insert(teamRosterTable).values({ teamId, userId, roleInTeam, status });
	}

	return c.json({ success: true });
});

// PATCH /:rosterId — Update roster status
rosterRoutes.patch("/:rosterId", async (c) => {
	const user = c.get("user");
	const rosterId = c.req.param("rosterId");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateRosterStatusSchema, { ...body, rosterId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { status } = parsed.output;

	const ctx = await getOrgIdForRoster(rosterId);
	if (!ctx) return c.json({ error: "Roster member not found." }, 404);

	const isManager = await verifyOrgManager(ctx.orgId, user.id);
	if (!isManager)
		return c.json({ error: "You do not have permission to manage this team's roster." }, 403);

	await db.update(teamRosterTable).set({ status }).where(eq(teamRosterTable.id, rosterId));

	return c.json({ success: true });
});

// DELETE /:rosterId — Remove player (soft delete)
rosterRoutes.delete("/:rosterId", async (c) => {
	const user = c.get("user");
	const rosterId = c.req.param("rosterId");

	const ctx = await getOrgIdForRoster(rosterId);
	if (!ctx) return c.json({ error: "Roster member not found." }, 404);

	const isManager = await verifyOrgManager(ctx.orgId, user.id);
	if (!isManager)
		return c.json({ error: "You do not have permission to manage this team's roster." }, 403);

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, rosterId));

	return c.json({ success: true });
});

export { rosterRoutes };
