import {
	ArchiveTeamSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	ToggleRecruitingSchema,
	UpdateTeamSchema,
} from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { createTeamIdInviteRoutes, teamInviteRoutes } from "@/routes/teams/invites";
import { rosterRoutes } from "@/routes/teams/roster";
import { getUserOrgRole, verifyOrgManager } from "@/utils/org";

const teamRoutes = new Hono<AuthEnv>();

// Mount sub-routes
teamRoutes.route("/invites", teamInviteRoutes);

// POST / — Create team
teamRoutes.post("/", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateTeamSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager)
		return c.json(
			{ error: "You do not have permission to create teams in this organisation." },
			403
		);

	const [team] = await db
		.insert(teamTable)
		.values({
			organizationId: orgId,
			name,
			tag: tag.toUpperCase(),
			description: description || null,
		})
		.returning({ id: teamTable.id });

	return c.json({ success: true, teamId: team.id });
});

// PATCH /:id — Update team
teamRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to edit this team." }, 403);

	await db
		.update(teamTable)
		.set({ name, tag: tag.toUpperCase(), description: description || null })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// PATCH /:id/recruiting — Toggle recruiting
teamRoutes.patch("/:id/recruiting", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ToggleRecruitingSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to manage this team." }, 403);

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { isRecruiting: true },
	});
	if (!team) return c.json({ error: "Team not found." }, 404);

	await db
		.update(teamTable)
		.set({ isRecruiting: !team.isRecruiting })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// POST /:id/archive — Archive team
teamRoutes.post("/:id/archive", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ArchiveTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to archive this team." }, 403);

	await db
		.update(teamTable)
		.set({ isArchived: true, isRecruiting: false })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// DELETE /:id — Delete team (owner only)
teamRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner")
		return c.json({ error: "Only the organisation owner can delete teams." }, 403);

	await db.delete(teamTable).where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// Mount roster and invite routes under /:id/
teamRoutes.route("/:id/roster", rosterRoutes);
teamRoutes.route("/:id/invites", createTeamIdInviteRoutes());

export { teamRoutes };
