import {
	CreateOrgSchema,
	DeleteOrgSchema,
	InviteToOrgSchema,
	RespondToOrgInviteSchema,
	UpdateOrgMemberRoleSchema,
	UpdateOrgSchema,
} from "@scrimflow/shared";
import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	organizationMemberTable,
	organizationTable,
	orgInviteTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { ensureUniqueSlug, getUserOrgRole, nameToSlug, verifyOrgManager } from "@/utils/org";

const orgRoutes = new Hono<AuthEnv>();

// GET / — List user's organizations
orgRoutes.get("/", async (c) => {
	const user = c.get("user");

	const rows = await db.query.organizationMemberTable.findMany({
		where: eq(organizationMemberTable.userId, user.id),
		with: {
			organization: {
				columns: {
					id: true,
					name: true,
					slug: true,
					avatarUrl: true,
					description: true,
				},
				with: {
					teams: {
						columns: { id: true },
						where: eq(teamTable.isArchived, false),
					},
				},
			},
		},
	});

	return c.json({
		data: rows.map((row) => ({
			id: row.organization.id,
			name: row.organization.name,
			slug: row.organization.slug,
			avatarUrl: row.organization.avatarUrl,
			description: row.organization.description ?? null,
			role: row.role,
			teamCount: row.organization.teams.length,
		})),
	});
});

// GET /invites/received — Pending org invites for the current user
orgRoutes.get("/invites/received", async (c) => {
	const user = c.get("user");
	const now = new Date();

	const rows = await db.query.orgInviteTable.findMany({
		where: eq(orgInviteTable.inviteeUserId, user.id),
		with: {
			organization: {
				columns: { id: true, name: true, avatarUrl: true },
			},
			inviter: { columns: { displayName: true } },
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return c.json({
		data: rows.map((r) => ({
			id: r.id,
			organizationId: r.organization.id,
			orgName: r.organization.name,
			orgAvatarUrl: r.organization.avatarUrl,
			inviterDisplayName: r.inviter.displayName,
			role: r.role,
			status: r.status === "pending" && r.expiresAt < now ? "expired" : r.status,
			expiresAt: r.expiresAt,
			createdAt: r.createdAt,
			statusChangedAt: r.updatedAt,
		})),
	});
});

// POST / — Create organization
orgRoutes.post("/", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateOrgSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { name, description } = parsed.output;
	const slug = await ensureUniqueSlug(nameToSlug(name));

	const [org] = await db
		.insert(organizationTable)
		.values({ name, slug, description: description || null, ownerId: user.id })
		.returning({ id: organizationTable.id });

	await db.insert(organizationMemberTable).values({
		organizationId: org.id,
		userId: user.id,
		role: "owner",
	});

	return c.json({ success: true, orgId: org.id });
});

// GET /:id — Get org detail with teams and members
orgRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");

	const membership = await getUserOrgRole(orgId, user.id);
	if (!membership) return c.json({ error: "Not a member of this organisation." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: {
			id: true,
			name: true,
			slug: true,
			avatarUrl: true,
			bannerUrl: true,
			description: true,
			ownerId: true,
		},
		with: {
			teams: {
				where: eq(teamTable.isArchived, false),
				columns: {
					id: true,
					name: true,
					tag: true,
					avatarUrl: true,
					teamSr: true,
					isRecruiting: true,
				},
			},
			members: {
				with: {
					user: {
						columns: {
							id: true,
							displayName: true,
							avatarUrl: true,
						},
					},
				},
			},
		},
	});

	if (!org) return c.json({ error: "Organisation not found." }, 404);

	return c.json({
		data: {
			id: org.id,
			name: org.name,
			slug: org.slug,
			avatarUrl: org.avatarUrl,
			bannerUrl: org.bannerUrl ?? null,
			description: org.description ?? null,
			ownerId: org.ownerId,
			teams: org.teams,
			members: org.members.map((m) => ({
				id: m.id,
				userId: m.user.id,
				displayName: m.user.displayName,
				avatarUrl: m.user.avatarUrl,
				role: m.role,
			})),
		},
	});
});

// GET /:id/invites — Pending invites for the org (manager/owner only)
orgRoutes.get("/:id/invites", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ data: [] });

	const now = new Date();
	const rows = await db.query.orgInviteTable.findMany({
		where: and(
			eq(orgInviteTable.organizationId, orgId),
			eq(orgInviteTable.status, "pending"),
			gt(orgInviteTable.expiresAt, now)
		),
		with: {
			invitee: {
				columns: { id: true, displayName: true, avatarUrl: true },
			},
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return c.json({
		data: rows.map((r) => ({
			id: r.id,
			inviteeUserId: r.invitee.id,
			inviteeDisplayName: r.invitee.displayName,
			inviteeAvatarUrl: r.invitee.avatarUrl,
			role: r.role,
			status: r.status === "pending" && r.expiresAt < now ? "expired" : r.status,
			expiresAt: r.expiresAt,
			createdAt: r.createdAt,
			statusChangedAt: r.updatedAt,
		})),
	});
});

// DELETE /:id/invites/:inviteId — Cancel org invite
orgRoutes.delete("/:id/invites/:inviteId", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to cancel invites." }, 403);

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		columns: { id: true, organizationId: true, status: true, expiresAt: true },
	});
	if (!invite || invite.organizationId !== orgId)
		return c.json({ error: "Invite not found." }, 404);

	const effectiveStatus =
		invite.status === "pending" && invite.expiresAt < new Date() ? "expired" : invite.status;
	if (effectiveStatus !== "pending")
		return c.json({ error: "Only pending invites can be cancelled." }, 400);

	await db
		.update(orgInviteTable)
		.set({ status: "cancelled" })
		.where(eq(orgInviteTable.id, inviteId));

	return c.json({ success: true });
});

// POST /:id/invites/:inviteId/resend — Extend expiry for pending invite
orgRoutes.post("/:id/invites/:inviteId/resend", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to resend invites." }, 403);

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		with: { organization: { columns: { name: true } } },
		columns: {
			id: true,
			organizationId: true,
			inviteeUserId: true,
			role: true,
			status: true,
			expiresAt: true,
		},
	});
	if (!invite || invite.organizationId !== orgId)
		return c.json({ error: "Invite not found." }, 404);

	const effectiveStatus =
		invite.status === "pending" && invite.expiresAt < new Date() ? "expired" : invite.status;
	if (effectiveStatus !== "pending")
		return c.json({ error: "Only pending invites can be resent." }, 400);

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await db.update(orgInviteTable).set({ expiresAt }).where(eq(orgInviteTable.id, inviteId));

	await createNotification({
		userId: invite.inviteeUserId,
		type: "org_invite_received",
		title: `You've been invited to join ${invite.organization?.name ?? "an organisation"}`,
		body: `You were invited as ${invite.role}.`,
		referenceType: "org_invite",
	});

	return c.json({ success: true });
});

// PATCH /:id — Update organization
orgRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const id = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateOrgSchema, { ...body, orgId: id });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, name, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager)
		return c.json({ error: "You do not have permission to edit this organisation." }, 403);

	await db
		.update(organizationTable)
		.set({ name, description: description || null })
		.where(eq(organizationTable.id, orgId));

	return c.json({ success: true });
});

// DELETE /:id — Delete organization (owner only)
orgRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const id = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteOrgSchema, { ...body, orgId: id });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, confirmName } = parsed.output;

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the organisation owner can delete it." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { name: true },
	});
	if (!org) return c.json({ error: "Organisation not found." }, 404);
	if (org.name !== confirmName) return c.json({ error: "Organisation name does not match." }, 400);

	await db.delete(organizationTable).where(eq(organizationTable.id, orgId));

	return c.json({ success: true });
});

// PATCH /:id/members/:userId/role — Update member role
orgRoutes.patch("/:id/members/:userId/role", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const memberId = c.req.param("userId");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateOrgMemberRoleSchema, { ...body, orgId, memberId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { role } = parsed.output;

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (actorRole !== "owner" && actorRole !== "manager")
		return c.json({ error: "You do not have permission to manage members." }, 403);

	if (actorRole === "manager" && (role === "owner" || role === "manager"))
		return c.json({ error: "Managers can only assign coach, analyst, or player roles." }, 403);

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { userId: true, role: true, organizationId: true },
	});
	if (!member || member.organizationId !== orgId)
		return c.json({ error: "Member not found." }, 404);
	if (member.role === "owner") return c.json({ error: "The owner's role cannot be changed." }, 400);

	await db
		.update(organizationMemberTable)
		.set({ role })
		.where(eq(organizationMemberTable.id, memberId));

	return c.json({ success: true });
});

// DELETE /:id/members/:userId — Remove member
orgRoutes.delete("/:id/members/:userId", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const memberId = c.req.param("userId");

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (actorRole !== "owner" && actorRole !== "manager")
		return c.json({ error: "You do not have permission to remove members." }, 403);

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { userId: true, role: true, organizationId: true },
	});
	if (!member || member.organizationId !== orgId)
		return c.json({ error: "Member not found." }, 404);
	if (member.role === "owner") return c.json({ error: "The owner cannot be removed." }, 400);

	// Mark all their team roster entries in this org as inactive
	const orgTeams = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.userId, member.userId),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true },
	});
	const rosterIds = orgTeams.filter((r) => r.team.organizationId === orgId).map((r) => r.id);

	await db.transaction(async (tx) => {
		for (const rosterId of rosterIds) {
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterId));
		}
		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, memberId));
	});

	return c.json({ success: true });
});

// DELETE /:id/leave — Leave organization as current user
orgRoutes.delete("/:id/leave", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");

	const membership = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, user.id)
		),
		columns: { id: true, role: true },
	});
	if (!membership) return c.json({ error: "You are not a member of this organisation." }, 404);
	if (membership.role === "owner")
		return c.json({ error: "The owner must transfer ownership before leaving." }, 400);

	await db.transaction(async (tx) => {
		const rosterEntries = await tx.query.teamRosterTable.findMany({
			where: eq(teamRosterTable.userId, user.id),
			with: { team: { columns: { organizationId: true } } },
			columns: { id: true },
		});
		const rosterIds = rosterEntries
			.filter((entry) => entry.team.organizationId === orgId)
			.map((entry) => entry.id);

		for (const rosterId of rosterIds) {
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterId));
		}

		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, membership.id));
	});

	return c.json({ success: true });
});

// POST /:id/invites — Invite to organization
orgRoutes.post("/:id/invites", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(InviteToOrgSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { userId, role } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to invite members." }, 403);

	// Check not already a member
	const existing = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: { id: true },
	});
	if (existing) return c.json({ error: "This user is already a member of the organisation." }, 409);

	// Check no pending invite
	const existingInvite = await db.query.orgInviteTable.findFirst({
		where: and(eq(orgInviteTable.organizationId, orgId), eq(orgInviteTable.inviteeUserId, userId)),
		columns: { id: true, status: true },
	});
	if (existingInvite?.status === "pending")
		return c.json({ error: "An invite is already pending for this user." }, 409);

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { name: true },
	});

	await db.insert(orgInviteTable).values({
		organizationId: orgId,
		inviteeUserId: userId,
		inviterUserId: user.id,
		role,
		expiresAt,
	});

	await createNotification({
		userId,
		type: "org_invite_received",
		title: `You've been invited to join ${org?.name ?? "an organisation"}`,
		body: `You were invited as ${role}.`,
		referenceType: "org_invite",
	});

	return c.json({ success: true });
});

// POST /invites/:id/respond — Accept/decline org invite
orgRoutes.post("/invites/:id/respond", async (c) => {
	const user = c.get("user");
	const inviteId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToOrgInviteSchema, { ...body, inviteId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { action } = parsed.output;

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		columns: {
			id: true,
			inviteeUserId: true,
			organizationId: true,
			role: true,
			status: true,
			expiresAt: true,
		},
	});
	if (!invite) return c.json({ error: "Invite not found." }, 404);
	if (invite.inviteeUserId !== user.id)
		return c.json({ error: "This invite is not for you." }, 403);
	if (invite.status !== "pending")
		return c.json({ error: "This invite is no longer active." }, 400);
	if (invite.expiresAt < new Date()) return c.json({ error: "This invite has expired." }, 400);

	if (action === "accept") {
		await db.transaction(async (tx) => {
			const alreadyMember = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, invite.organizationId),
					eq(organizationMemberTable.userId, user.id)
				),
				columns: { id: true },
			});
			if (!alreadyMember) {
				await tx.insert(organizationMemberTable).values({
					organizationId: invite.organizationId,
					userId: user.id,
					role: invite.role,
				});
			}
			await tx
				.update(orgInviteTable)
				.set({ status: "accepted" })
				.where(eq(orgInviteTable.id, inviteId));
		});
	} else {
		await db
			.update(orgInviteTable)
			.set({ status: "declined" })
			.where(eq(orgInviteTable.id, inviteId));
	}

	return c.json({ success: true });
});

export { orgRoutes };
