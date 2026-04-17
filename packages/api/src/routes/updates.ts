import {
	CreateUpdatePostSchema,
	type UpdatePostSummary,
	UpdateUpdatePostSchema,
} from "@scrimflow/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { updatePostTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { publishTeamEvent } from "@/realtime/scrim-hub";
import { extractErrors } from "@/routes/auth/utils";
import { getOrgPermissions } from "@/utils/org";
import { getTeamAccessContext, listTeamWorkspaceUserIds } from "@/utils/team";
import { mapUpdatePost } from "@/utils/updates";

const updatesRoutes = new Hono<AuthEnv>();
const publicUpdatesRoutes = new Hono<AuthEnv>();

const TEAM_VIEWABLE_STATUSES = ["active", "benched", "trial"] as const;

async function listUpdatePosts(params: {
	teamId?: string;
	organizationId?: string;
	publicOnly?: boolean;
	canManage?: boolean;
}): Promise<UpdatePostSummary[]> {
	const rows = await db.query.updatePostTable.findMany({
		where: and(
			params.teamId ? eq(updatePostTable.teamId, params.teamId) : undefined,
			params.organizationId ? eq(updatePostTable.organizationId, params.organizationId) : undefined,
			params.publicOnly ? eq(updatePostTable.visibility, "public") : undefined
		),
		with: {
			author: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			team: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
				},
			},
			organization: {
				columns: {
					id: true,
					name: true,
					slug: true,
				},
			},
		},
		orderBy: [desc(updatePostTable.createdAt)],
		limit: 50,
	});

	return rows.map((row) => mapUpdatePost(row, { canManage: params.canManage }));
}

async function getUpdatePost(updateId: string) {
	return db.query.updatePostTable.findFirst({
		where: eq(updatePostTable.id, updateId),
		with: {
			author: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			team: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
				},
			},
			organization: {
				columns: {
					id: true,
					name: true,
					slug: true,
				},
			},
		},
	});
}

updatesRoutes.get("/", async (c) => {
	const user = c.get("user");
	const teamId = c.req.query("teamId");
	const organizationId = c.req.query("organizationId");

	if (!teamId && !organizationId) {
		return c.json({ error: "teamId or organizationId is required." }, 400);
	}

	if (teamId) {
		const access = await getTeamAccessContext(teamId, user.id);
		if (!access) return c.json({ error: "Team not found." }, 404);

		const canView = access.canManageTeam
			? true
			: access.teamStatus
				? TEAM_VIEWABLE_STATUSES.includes(
						access.teamStatus as (typeof TEAM_VIEWABLE_STATUSES)[number]
					)
				: false;

		if (!canView) {
			return c.json({ error: "You do not have access to this team's updates." }, 403);
		}

		return c.json({
			data: await listUpdatePosts({
				teamId,
				canManage: access.canManageTeam,
			}),
		});
	}

	if (!organizationId) {
		return c.json({ error: "organizationId is required." }, 400);
	}

	const permissions = await getOrgPermissions(organizationId, user.id);
	if (!permissions.role) {
		return c.json({ error: "You do not have access to this organization's updates." }, 403);
	}

	return c.json({
		data: await listUpdatePosts({
			organizationId,
			canManage: permissions.canManage,
		}),
	});
});

updatesRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateUpdatePostSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	let teamId: string | null = null;
	let organizationId: string | null = null;

	if (parsed.output.scopeType === "team") {
		if (!parsed.output.teamId) {
			return c.json({ error: "Team updates require a team ID." }, 400);
		}

		const access = await getTeamAccessContext(parsed.output.teamId, user.id);
		if (!access?.canManageTeam) {
			return c.json({ error: "You do not have permission to publish team updates." }, 403);
		}

		teamId = access.teamId;
		organizationId = access.organizationId;
	} else {
		if (!parsed.output.organizationId) {
			return c.json({ error: "Organization updates require an organization ID." }, 400);
		}

		const permissions = await getOrgPermissions(parsed.output.organizationId, user.id);
		if (!permissions.canManage) {
			return c.json({ error: "You do not have permission to publish organization updates." }, 403);
		}

		organizationId = parsed.output.organizationId;
	}

	const [created] = await db
		.insert(updatePostTable)
		.values({
			scopeType: parsed.output.scopeType,
			visibility: parsed.output.visibility,
			authorUserId: user.id,
			teamId,
			organizationId,
			title: parsed.output.title,
			body: parsed.output.body,
		})
		.returning({ id: updatePostTable.id });

	const update = await getUpdatePost(created.id);
	if (!update) return c.json({ error: "Update not found after creation." }, 500);

	const mapped = mapUpdatePost(update, { canManage: true });

	if (teamId) {
		const audienceUserIds = await listTeamWorkspaceUserIds(teamId);
		await Promise.all(
			audienceUserIds
				.filter((userId) => userId !== user.id)
				.map((userId) =>
					createNotification({
						userId,
						type: "generic",
						title: "New team update",
						body: mapped.title,
						referenceType: "update_post",
						referenceId: mapped.id,
					})
				)
		);

		publishTeamEvent({
			teamId,
			event: "update:created",
			payload: {
				update: mapped,
			},
		});
	}

	return c.json({ data: mapped }, 201);
});

updatesRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const updateId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateUpdatePostSchema, { ...body, updateId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const existing = await getUpdatePost(updateId);
	if (!existing) return c.json({ error: "Update not found." }, 404);

	if (existing.scopeType === "team") {
		if (!existing.teamId) return c.json({ error: "Invalid team update." }, 400);
		const access = await getTeamAccessContext(existing.teamId, user.id);
		if (!access?.canManageTeam) {
			return c.json({ error: "You do not have permission to manage this update." }, 403);
		}
	} else {
		if (!existing.organizationId) return c.json({ error: "Invalid organization update." }, 400);
		const permissions = await getOrgPermissions(existing.organizationId, user.id);
		if (!permissions.canManage) {
			return c.json({ error: "You do not have permission to manage this update." }, 403);
		}
	}

	await db
		.update(updatePostTable)
		.set({
			title: parsed.output.title,
			body: parsed.output.body,
			visibility: parsed.output.visibility,
		})
		.where(eq(updatePostTable.id, updateId));

	const updated = await getUpdatePost(updateId);
	if (!updated) return c.json({ error: "Update not found after update." }, 500);

	const mapped = mapUpdatePost(updated, { canManage: true });
	if (updated.teamId) {
		publishTeamEvent({
			teamId: updated.teamId,
			event: "update:updated",
			payload: {
				update: mapped,
			},
		});
	}

	return c.json({ data: mapped });
});

updatesRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const updateId = c.req.param("id");
	const existing = await getUpdatePost(updateId);
	if (!existing) return c.json({ error: "Update not found." }, 404);

	if (existing.scopeType === "team") {
		if (!existing.teamId) return c.json({ error: "Invalid team update." }, 400);
		const access = await getTeamAccessContext(existing.teamId, user.id);
		if (!access?.canManageTeam) {
			return c.json({ error: "You do not have permission to delete this update." }, 403);
		}
	} else {
		if (!existing.organizationId) return c.json({ error: "Invalid organization update." }, 400);
		const permissions = await getOrgPermissions(existing.organizationId, user.id);
		if (!permissions.canManage) {
			return c.json({ error: "You do not have permission to delete this update." }, 403);
		}
	}

	await db.delete(updatePostTable).where(eq(updatePostTable.id, updateId));

	if (existing.teamId) {
		publishTeamEvent({
			teamId: existing.teamId,
			event: "update:deleted",
			payload: {
				updateId,
			},
		});
	}

	return c.json({ success: true });
});

publicUpdatesRoutes.get("/", async (c) => {
	const teamId = c.req.query("teamId");
	const organizationId = c.req.query("organizationId");

	return c.json({
		data: await listUpdatePosts({
			teamId: teamId ?? undefined,
			organizationId: organizationId ?? undefined,
			publicOnly: true,
		}),
	});
});

export { publicUpdatesRoutes, updatesRoutes };
