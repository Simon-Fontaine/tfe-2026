import {
	ApplyToLfgPostSchema,
	CloseLfgPostSchema,
	CreateLfgPostSchema,
	RespondToApplicationSchema,
} from "@scrimflow/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	lfgApplicationTable,
	lfgPostTable,
	organizationMemberTable,
	teamRosterTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { getTeamAccessContext, isUserOnTeam } from "@/utils/team";

const lfgRoutes = new Hono<AuthEnv>();

// GET / — List open LFG posts with optional filters
lfgRoutes.get("/", async (c) => {
	const typeFilter = c.req.query("type");
	const roleFilter = c.req.query("role");
	const regionFilter = c.req.query("region");

	const rows = await db.query.lfgPostTable.findMany({
		where: and(
			eq(lfgPostTable.status, "open"),
			typeFilter
				? eq(lfgPostTable.type, typeFilter as "team_seeking_player" | "player_seeking_team")
				: undefined
		),
		with: {
			user: {
				columns: { id: true, displayName: true, avatarUrl: true },
			},
			team: {
				columns: {
					id: true,
					name: true,
					tag: true,
					avatarUrl: true,
					teamSr: true,
				},
			},
		},
		orderBy: [desc(lfgPostTable.createdAt)],
		limit: 50,
	});

	const filtered = rows.filter((r) => {
		if (roleFilter && !(r.rolesNeeded as string[]).includes(roleFilter)) return false;
		if (regionFilter && r.region !== regionFilter) return false;
		return true;
	});

	return c.json({
		data: filtered.map((r) => ({
			id: r.id,
			type: r.type,
			status: r.status,
			rolesNeeded: (r.rolesNeeded as string[]) ?? [],
			minRank: r.minRank ?? null,
			maxRank: r.maxRank ?? null,
			description: r.description ?? null,
			region: r.region ?? null,
			expiresAt: r.expiresAt ?? null,
			createdAt: r.createdAt,
			userId: r.user.id,
			userDisplayName: r.user.displayName,
			userAvatarUrl: r.user.avatarUrl,
			teamId: r.team?.id ?? null,
			teamName: r.team?.name ?? null,
			teamTag: r.team?.tag ?? null,
			teamAvatarUrl: r.team?.avatarUrl ?? null,
			teamSr: r.team?.teamSr ?? null,
		})),
	});
});

// GET /applications — Current user's LFG applications
lfgRoutes.get("/applications", async (c) => {
	const user = c.get("user");

	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.applicantUserId, user.id),
		with: {
			post: {
				columns: { id: true },
				with: {
					team: { columns: { name: true, tag: true } },
				},
			},
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
		limit: 30,
	});

	return c.json({
		data: rows.map((r) => ({
			id: r.id,
			status: r.status,
			message: r.message ?? null,
			createdAt: r.createdAt,
			postId: r.postId,
			teamName: r.post.team?.name ?? null,
			teamTag: r.post.team?.tag ?? null,
		})),
	});
});

// POST / — Create LFG post
lfgRoutes.post("/", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateLfgPostSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { teamId, rolesNeeded: roles, minRank, maxRank, description, region } = parsed.output;
	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to post on behalf of this team." }, 403);

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const [post] = await db
		.insert(lfgPostTable)
		.values({
			type: "team_seeking_player",
			userId: user.id,
			teamId,
			rolesNeeded: roles,
			minRank: minRank ?? null,
			maxRank: maxRank ?? null,
			description: description ?? null,
			region: region ?? null,
			expiresAt,
		})
		.returning({ id: lfgPostTable.id });

	return c.json({ success: true, postId: post.id });
});

// POST /:id/close — Close LFG post
lfgRoutes.post("/:id/close", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CloseLfgPostSchema, { ...body, postId: c.req.param("id") });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { postId } = parsed.output;
	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		with: { team: { columns: { id: true } } },
		columns: { id: true, teamId: true },
	});
	if (!post) return c.json({ error: "Post not found." }, 404);
	if (!post.teamId) return c.json({ error: "Post is not associated with a team." }, 400);

	const access = await getTeamAccessContext(post.teamId, user.id);
	if (!access || !access.canManageTeam)
		return c.json({ error: "You do not have permission to close this post." }, 403);

	await db.update(lfgPostTable).set({ status: "closed" }).where(eq(lfgPostTable.id, postId));

	return c.json({ success: true });
});

// POST /:id/apply — Apply to LFG post
lfgRoutes.post("/:id/apply", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("id");

	const body = await c.req.json().catch(() => null);

	const parsed = v.safeParse(ApplyToLfgPostSchema, { ...body, postId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { message } = parsed.output;

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: { id: true, status: true, teamId: true, userId: true },
	});
	if (!post) return c.json({ error: "Post not found." }, 404);
	if (post.status !== "open")
		return c.json({ error: "This post is no longer accepting applications." }, 400);

	// Prevent applying to own team's post
	if (post.teamId) {
		const onTeam = await isUserOnTeam(user.id, post.teamId);
		if (onTeam) return c.json({ error: "You are already a member of this team." }, 409);
	}

	const existing = await db.query.lfgApplicationTable.findFirst({
		where: and(
			eq(lfgApplicationTable.postId, postId),
			eq(lfgApplicationTable.applicantUserId, user.id)
		),
		columns: { id: true, status: true },
	});
	if (existing && existing.status === "pending")
		return c.json({ error: "You have already applied to this post." }, 409);

	await db.insert(lfgApplicationTable).values({
		postId,
		applicantUserId: user.id,
		message: message ?? null,
	});

	await createNotification({
		userId: post.userId,
		type: "recruitment_application",
		title: "New application received",
		body: message ?? undefined,
		referenceType: "lfg_post",
		referenceId: postId,
	});

	return c.json({ success: true });
});

// DELETE /:id/applications/:appId — Withdraw application
lfgRoutes.delete("/:id/applications/:appId", async (c) => {
	const user = c.get("user");
	const applicationId = c.req.param("appId");

	const app = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, applicationId),
		columns: { id: true, applicantUserId: true, status: true },
	});
	if (!app) return c.json({ error: "Application not found." }, 404);
	if (app.applicantUserId !== user.id)
		return c.json({ error: "This application is not yours." }, 403);
	if (app.status !== "pending")
		return c.json({ error: "This application is no longer active." }, 400);

	await db
		.update(lfgApplicationTable)
		.set({ status: "withdrawn" })
		.where(eq(lfgApplicationTable.id, applicationId));

	return c.json({ success: true });
});

// POST /:id/applications/:appId/respond — Accept/reject application
lfgRoutes.post("/:id/applications/:appId/respond", async (c) => {
	const user = c.get("user");
	const applicationId = c.req.param("appId");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToApplicationSchema, { ...body, applicationId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { action, roleInTeam } = parsed.output;

	const app = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, applicationId),
		with: {
			post: { columns: { id: true, teamId: true, status: true } },
		},
		columns: { id: true, applicantUserId: true, status: true, postId: true },
	});
	if (!app) return c.json({ error: "Application not found." }, 404);
	if (app.status !== "pending")
		return c.json({ error: "This application has already been reviewed." }, 400);
	if (app.post.status !== "open")
		return c.json({ error: "The associated post is no longer open." }, 400);
	if (!app.post.teamId) return c.json({ error: "No team associated with this post." }, 400);

	const access = await getTeamAccessContext(app.post.teamId, user.id);
	if (!access || !access.canManageTeam)
		return c.json({ error: "You do not have permission to respond to applications." }, 403);

	if (action === "accept") {
		const postTeamId = app.post.teamId;
		const role = roleInTeam ?? "damage";

		await db.transaction(async (tx) => {
			const existing = await tx.query.teamRosterTable.findFirst({
				where: and(
					eq(teamRosterTable.teamId, postTeamId),
					eq(teamRosterTable.userId, app.applicantUserId)
				),
				columns: { id: true },
			});

			if (existing) {
				await tx
					.update(teamRosterTable)
					.set({
						status: "trial",
						roleInTeam: role as "tank" | "damage" | "support",
						permissionRole: "member",
						leftAt: null,
						joinedAt: new Date(),
					})
					.where(eq(teamRosterTable.id, existing.id));
			} else {
				await tx.insert(teamRosterTable).values({
					teamId: postTeamId,
					userId: app.applicantUserId,
					roleInTeam: role as "tank" | "damage" | "support",
					permissionRole: "member",
					status: "trial",
					joinedAt: new Date(),
				});
			}

			const orgMember = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, access.organizationId),
					eq(organizationMemberTable.userId, app.applicantUserId)
				),
				columns: { id: true },
			});
			if (!orgMember) {
				await tx.insert(organizationMemberTable).values({
					organizationId: access.organizationId,
					userId: app.applicantUserId,
					role: "player",
				});
			}

			await tx
				.update(lfgApplicationTable)
				.set({ status: "accepted" })
				.where(eq(lfgApplicationTable.id, applicationId));
		});

		await createNotification({
			userId: app.applicantUserId,
			type: "recruitment_accepted",
			title: "Your application was accepted!",
			referenceType: "lfg_application",
			referenceId: applicationId,
		});
	} else {
		await db
			.update(lfgApplicationTable)
			.set({ status: "rejected" })
			.where(eq(lfgApplicationTable.id, applicationId));

		await createNotification({
			userId: app.applicantUserId,
			type: "recruitment_rejected",
			title: "Your application was not accepted.",
			referenceType: "lfg_application",
			referenceId: applicationId,
		});
	}

	return c.json({ success: true });
});

export { lfgRoutes };
