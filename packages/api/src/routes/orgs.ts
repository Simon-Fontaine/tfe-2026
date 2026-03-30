import {
	CreateOrgSchema,
	canAssignOrgRole,
	DeleteOrgSchema,
	InviteToOrgSchema,
	RespondToOrgInviteSchema,
	TransferOrgOwnershipSchema,
	UpdateOrgMemberSchema,
	UpdateOrgSchema,
} from "@scrimflow/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	lfgPostTable,
	organizationMemberTable,
	organizationTable,
	orgInviteTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { ensureUniqueSlug, getOrgPermissions, getUserOrgRole, nameToSlug } from "@/utils/org";
import {
	ensureOrganizationMembership,
	getRecruitmentConversationsForUser,
	mapRecruitmentPost,
} from "@/utils/recruit";

const orgRoutes = new Hono<AuthEnv>();

function getEffectiveInviteStatus(status: string, expiresAt: Date) {
	return status === "pending" && expiresAt < new Date() ? "expired" : status;
}

function toOrgTeamSummary(
	org: { id: string; name: string; slug: string },
	team: {
		id: string;
		organizationId: string;
		name: string;
		tag: string;
		description: string | null;
		avatarUrl: string | null;
		bannerUrl: string | null;
		teamSr: number;
		matchesPlayed: number;
		isRecruiting: boolean;
		isArchived: boolean;
		roster: Array<{ userId: string; permissionRole: "admin" | "member"; status: string }>;
	}
) {
	const activeRosterCount = team.roster.filter((member) => member.status !== "inactive").length;
	const adminCount = new Set(
		team.roster
			.filter((member) => member.status !== "inactive" && member.permissionRole === "admin")
			.map((member) => member.userId)
	).size;

	return {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: org.name,
		organizationSlug: org.slug,
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		bannerUrl: team.bannerUrl ?? null,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount,
		adminCount,
	};
}

async function getOrgWorkspaceDetail(orgId: string, userId: string) {
	const permissions = await getOrgPermissions(orgId, userId);
	if (!permissions.role) return null;

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
				columns: {
					id: true,
					organizationId: true,
					name: true,
					tag: true,
					description: true,
					avatarUrl: true,
					bannerUrl: true,
					teamSr: true,
					matchesPlayed: true,
					isRecruiting: true,
					isArchived: true,
				},
				with: {
					roster: {
						columns: {
							userId: true,
							permissionRole: true,
							status: true,
						},
					},
				},
				orderBy: [asc(teamTable.name)],
			},
			members: {
				with: {
					user: {
						columns: { id: true, username: true, displayName: true, avatarUrl: true },
					},
				},
				orderBy: [asc(organizationMemberTable.createdAt)],
			},
		},
	});
	if (!org) return null;

	const [inviteRows, postRows, conversations] = await Promise.all([
		db.query.orgInviteTable.findMany({
			where: eq(orgInviteTable.organizationId, orgId),
			with: {
				invitee: { columns: { id: true, displayName: true, avatarUrl: true } },
			},
			orderBy: [desc(orgInviteTable.createdAt)],
		}),
		db.query.lfgPostTable.findMany({
			where: eq(lfgPostTable.organizationId, orgId),
			with: {
				user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
				organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
				team: {
					columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true },
				},
				applications: {
					columns: { id: true, status: true, applicantUserId: true },
				},
			},
			orderBy: [desc(lfgPostTable.createdAt)],
		}),
		getRecruitmentConversationsForUser(userId),
	]);

	const activeTeamCountsByUser = new Map<string, number>();
	for (const team of org.teams) {
		for (const member of team.roster) {
			if (member.status === "inactive") continue;
			activeTeamCountsByUser.set(
				member.userId,
				(activeTeamCountsByUser.get(member.userId) ?? 0) + 1
			);
		}
	}

	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
		avatarUrl: org.avatarUrl,
		bannerUrl: org.bannerUrl ?? null,
		description: org.description ?? null,
		ownerId: org.ownerId,
		currentUser: {
			role: permissions.role,
			canManage: permissions.canManage,
			canDelete: permissions.canDelete,
			canTransferOwnership: permissions.canTransferOwnership,
			canLeave: permissions.canLeave,
			canManageMembers: permissions.canManageMembers,
			canManageTeams: permissions.canManageTeams,
			canManageInvites: permissions.canManage,
			canManageSettings: permissions.canManage,
			canReviewRequests: false,
		},
		activeTeams: org.teams
			.filter((team) => !team.isArchived)
			.map((team) => toOrgTeamSummary(org, team)),
		archivedTeams: org.teams
			.filter((team) => team.isArchived)
			.map((team) => toOrgTeamSummary(org, team)),
		members: org.members.map((member) => ({
			id: member.id,
			userId: member.user.id,
			username: member.user.username,
			displayName: member.user.displayName,
			avatarUrl: member.user.avatarUrl,
			permissionRole: member.role,
			role: member.role,
			memberType: member.memberType,
			staffRole: member.staffRole ?? null,
			gameRole: member.gameRole ?? null,
			activeTeamCount: activeTeamCountsByUser.get(member.user.id) ?? 0,
			joinedAt: member.createdAt.toISOString(),
		})),
		pendingInvites: inviteRows
			.map((invite) => ({
				id: invite.id,
				inviteeUserId: invite.invitee.id,
				inviteeDisplayName: invite.invitee.displayName,
				inviteeAvatarUrl: invite.invitee.avatarUrl,
				permissionRole: invite.role,
				role: invite.role,
				memberType: invite.memberType,
				staffRole: invite.staffRole ?? null,
				gameRole: invite.gameRole ?? null,
				status: getEffectiveInviteStatus(invite.status, invite.expiresAt),
				expiresAt: invite.expiresAt.toISOString(),
				createdAt: invite.createdAt.toISOString(),
				statusChangedAt: invite.updatedAt.toISOString(),
			}))
			.filter((invite) => invite.status === "pending"),
		ownedPosts: postRows.map((post) =>
			mapRecruitmentPost(post, {
				viewerId: userId,
				canManage: permissions.canManage,
			})
		),
		conversations: conversations.filter((conversation) => conversation.organizationId === orgId),
		pendingJoinRequests: [],
	};
}

orgRoutes.get("/", async (c) => {
	const user = c.get("user");

	const memberships = await db.query.organizationMemberTable.findMany({
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
						where: eq(teamTable.isArchived, false),
						columns: { id: true, name: true, tag: true },
						with: {
							roster: {
								where: eq(teamRosterTable.userId, user.id),
								columns: { permissionRole: true },
							},
						},
					},
					lfgPosts: {
						where: eq(lfgPostTable.status, "open"),
						columns: { id: true },
					},
				},
			},
		},
		orderBy: [asc(organizationMemberTable.createdAt)],
	});

	return c.json({
		data: memberships.map((membership) => ({
			id: membership.organization.id,
			name: membership.organization.name,
			slug: membership.organization.slug,
			avatarUrl: membership.organization.avatarUrl,
			description: membership.organization.description ?? null,
			role: membership.role,
			teamCount: membership.organization.teams.length,
			openPostCount: membership.organization.lfgPosts.length,
			canManage: membership.role === "owner" || membership.role === "admin",
			teams: membership.organization.teams.map((t) => ({
				id: t.id,
				name: t.name,
				tag: t.tag,
				canManage:
					membership.role === "owner" ||
					membership.role === "admin" ||
					t.roster[0]?.permissionRole === "admin",
			})),
		})),
	});
});

orgRoutes.get("/invites/received", async (c) => {
	const user = c.get("user");
	const rows = await db.query.orgInviteTable.findMany({
		where: eq(orgInviteTable.inviteeUserId, user.id),
		with: {
			organization: {
				columns: { id: true, name: true, avatarUrl: true },
			},
			inviter: { columns: { displayName: true } },
		},
		orderBy: [desc(orgInviteTable.createdAt)],
	});

	return c.json({
		data: rows.map((row) => ({
			id: row.id,
			organizationId: row.organization.id,
			orgName: row.organization.name,
			orgAvatarUrl: row.organization.avatarUrl,
			inviterDisplayName: row.inviter.displayName,
			permissionRole: row.role,
			role: row.role,
			memberType: row.memberType,
			staffRole: row.staffRole ?? null,
			gameRole: row.gameRole ?? null,
			status: getEffectiveInviteStatus(row.status, row.expiresAt),
			expiresAt: row.expiresAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			statusChangedAt: row.updatedAt.toISOString(),
		})),
	});
});

orgRoutes.post("/invites/:id/respond", async (c) => {
	const user = c.get("user");
	const inviteId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToOrgInviteSchema, { ...body, inviteId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		columns: {
			id: true,
			inviteeUserId: true,
			organizationId: true,
			role: true,
			memberType: true,
			staffRole: true,
			gameRole: true,
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

	if (parsed.output.action === "accept") {
		await db.transaction(async (tx) => {
			await ensureOrganizationMembership(tx, {
				organizationId: invite.organizationId,
				userId: user.id,
				role: invite.role,
				memberType: invite.memberType,
				staffRole: invite.staffRole ?? null,
				gameRole: invite.gameRole ?? null,
			});

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

orgRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateOrgSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const slug = await ensureUniqueSlug(nameToSlug(parsed.output.name));
	const [org] = await db
		.insert(organizationTable)
		.values({
			name: parsed.output.name,
			slug,
			description: parsed.output.description || null,
			avatarUrl: parsed.output.avatarUrl || null,
			bannerUrl: parsed.output.bannerUrl || null,
			ownerId: user.id,
		})
		.returning({ id: organizationTable.id });

	await db.insert(organizationMemberTable).values({
		organizationId: org.id,
		userId: user.id,
		role: "owner",
		memberType: "staff",
		staffRole: "manager",
	});

	return c.json({ success: true, orgId: org.id });
});

orgRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const detail = await getOrgWorkspaceDetail(c.req.param("id"), user.id);
	if (!detail) return c.json({ error: "Organisation not found or inaccessible." }, 404);
	return c.json({ data: detail });
});

orgRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateOrgSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canManage) {
		return c.json({ error: "You do not have permission to edit this organisation." }, 403);
	}

	const slug = parsed.output.slug
		? await ensureUniqueSlug(parsed.output.slug, orgId)
		: await ensureUniqueSlug(nameToSlug(parsed.output.name), orgId);

	await db
		.update(organizationTable)
		.set({
			name: parsed.output.name,
			slug,
			description: parsed.output.description || null,
			avatarUrl: parsed.output.avatarUrl || null,
			bannerUrl: parsed.output.bannerUrl || null,
		})
		.where(eq(organizationTable.id, orgId));

	return c.json({ success: true });
});

orgRoutes.post("/:id/ownership", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(TransferOrgOwnershipSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canTransferOwnership || !permissions.membership) {
		return c.json({ error: "Only the org owner can transfer ownership." }, 403);
	}
	const currentMembershipId = permissions.membership.id;

	const target = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, parsed.output.memberId),
		columns: { id: true, organizationId: true, userId: true },
	});
	if (!target || target.organizationId !== orgId)
		return c.json({ error: "Target member not found." }, 404);

	await db.transaction(async (tx) => {
		await tx
			.update(organizationMemberTable)
			.set({ role: "admin" })
			.where(eq(organizationMemberTable.id, currentMembershipId));

		await tx
			.update(organizationMemberTable)
			.set({ role: "owner", memberType: "staff", staffRole: "manager" })
			.where(eq(organizationMemberTable.id, target.id));

		await tx
			.update(organizationTable)
			.set({ ownerId: target.userId })
			.where(eq(organizationTable.id, orgId));
	});

	return c.json({ success: true });
});

orgRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteOrgSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can delete it." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { id: true, name: true },
	});
	if (!org) return c.json({ error: "Organisation not found." }, 404);
	if (org.name !== parsed.output.confirmName) {
		return c.json({ error: "Organisation name does not match." }, 400);
	}

	await db.delete(organizationTable).where(eq(organizationTable.id, orgId));
	return c.json({ success: true });
});

orgRoutes.patch("/:id/members/:memberId/role", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const memberId = c.req.param("memberId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateOrgMemberSchema, { ...body, orgId, memberId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (parsed.output.role && !canAssignOrgRole(actorRole, parsed.output.role)) {
		return c.json({ error: "You do not have permission to assign that role." }, 403);
	}

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { id: true, organizationId: true, role: true },
	});
	if (!member || member.organizationId !== orgId)
		return c.json({ error: "Member not found." }, 404);
	if (member.role === "owner") return c.json({ error: "The owner's role cannot be changed." }, 400);
	if (actorRole !== "owner" && member.role === "admin") {
		return c.json({ error: "Only the owner can modify another admin." }, 403);
	}

	await db
		.update(organizationMemberTable)
		.set({
			role: parsed.output.role ?? undefined,
			memberType: parsed.output.memberType ?? undefined,
			staffRole: parsed.output.staffRole ?? undefined,
			gameRole: parsed.output.gameRole ?? undefined,
		})
		.where(eq(organizationMemberTable.id, memberId));

	return c.json({ success: true });
});

orgRoutes.delete("/:id/members/:memberId", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const memberId = c.req.param("memberId");

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (actorRole !== "owner" && actorRole !== "admin") {
		return c.json({ error: "You do not have permission to remove members." }, 403);
	}

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { id: true, organizationId: true, role: true, userId: true },
	});
	if (!member || member.organizationId !== orgId)
		return c.json({ error: "Member not found." }, 404);
	if (member.role === "owner") return c.json({ error: "The owner cannot be removed." }, 400);
	if (actorRole !== "owner" && member.role === "admin") {
		return c.json({ error: "Only the owner can remove another admin." }, 403);
	}

	const orgTeams = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.userId, member.userId),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true },
	});

	await db.transaction(async (tx) => {
		for (const rosterEntry of orgTeams.filter((row) => row.team.organizationId === orgId)) {
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterEntry.id));
		}

		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, member.id));
	});

	return c.json({ success: true });
});

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
	if (membership.role === "owner") {
		return c.json({ error: "The owner must transfer ownership before leaving." }, 400);
	}

	const rosterEntries = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.userId, user.id),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true },
	});

	await db.transaction(async (tx) => {
		for (const rosterEntry of rosterEntries.filter((row) => row.team.organizationId === orgId)) {
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterEntry.id));
		}

		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, membership.id));
	});

	return c.json({ success: true });
});

orgRoutes.get("/:id/invites", async (c) => {
	const user = c.get("user");
	const permissions = await getOrgPermissions(c.req.param("id"), user.id);
	if (!permissions.canManage) return c.json({ data: [] });

	const rows = await db.query.orgInviteTable.findMany({
		where: eq(orgInviteTable.organizationId, c.req.param("id")),
		with: {
			invitee: { columns: { id: true, displayName: true, avatarUrl: true } },
		},
		orderBy: [desc(orgInviteTable.createdAt)],
	});

	return c.json({
		data: rows
			.map((row) => ({
				id: row.id,
				inviteeUserId: row.invitee.id,
				inviteeDisplayName: row.invitee.displayName,
				inviteeAvatarUrl: row.invitee.avatarUrl,
				permissionRole: row.role,
				role: row.role,
				memberType: row.memberType,
				staffRole: row.staffRole ?? null,
				gameRole: row.gameRole ?? null,
				status: getEffectiveInviteStatus(row.status, row.expiresAt),
				expiresAt: row.expiresAt.toISOString(),
				createdAt: row.createdAt.toISOString(),
				statusChangedAt: row.updatedAt.toISOString(),
			}))
			.filter((row) => row.status === "pending"),
	});
});

orgRoutes.post("/:id/invites", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(InviteToOrgSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (!canAssignOrgRole(actorRole, parsed.output.role)) {
		return c.json({ error: "You do not have permission to invite members with that role." }, 403);
	}

	const membership = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, parsed.output.userId)
		),
		columns: { id: true },
	});
	if (membership)
		return c.json({ error: "This user is already a member of the organisation." }, 409);

	const existingInvite = await db.query.orgInviteTable.findFirst({
		where: and(
			eq(orgInviteTable.organizationId, orgId),
			eq(orgInviteTable.inviteeUserId, parsed.output.userId),
			eq(orgInviteTable.status, "pending")
		),
		columns: { id: true, expiresAt: true },
	});
	if (existingInvite && existingInvite.expiresAt > new Date()) {
		return c.json({ error: "An invite is already pending for this user." }, 409);
	}

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { name: true },
	});

	await db.insert(orgInviteTable).values({
		organizationId: orgId,
		inviteeUserId: parsed.output.userId,
		inviterUserId: user.id,
		role: parsed.output.role,
		memberType: parsed.output.memberType ?? "player",
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? null,
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	});

	await createNotification({
		userId: parsed.output.userId,
		type: "org_invite_received",
		title: `You've been invited to join ${org?.name ?? "an organisation"}`,
		body: `Access: ${parsed.output.role}.`,
		referenceType: "org_invite",
	});

	return c.json({ success: true });
});

orgRoutes.delete("/:id/invites/:inviteId", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canManage)
		return c.json({ error: "You do not have permission to cancel invites." }, 403);

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		columns: { id: true, organizationId: true, status: true, expiresAt: true },
	});
	if (!invite || invite.organizationId !== orgId)
		return c.json({ error: "Invite not found." }, 404);
	if (getEffectiveInviteStatus(invite.status, invite.expiresAt) !== "pending") {
		return c.json({ error: "Only pending invites can be cancelled." }, 400);
	}

	await db
		.update(orgInviteTable)
		.set({ status: "cancelled" })
		.where(eq(orgInviteTable.id, inviteId));

	return c.json({ success: true });
});

orgRoutes.post("/:id/invites/:inviteId/resend", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canManage)
		return c.json({ error: "You do not have permission to resend invites." }, 403);

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		with: { organization: { columns: { name: true } } },
	});
	if (!invite || invite.organizationId !== orgId)
		return c.json({ error: "Invite not found." }, 404);
	if (invite.status !== "pending")
		return c.json({ error: "Only pending invites can be resent." }, 400);

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await db.update(orgInviteTable).set({ expiresAt }).where(eq(orgInviteTable.id, inviteId));

	await createNotification({
		userId: invite.inviteeUserId,
		type: "org_invite_received",
		title: `You've been invited to join ${invite.organization?.name ?? "an organisation"}`,
		body: `Access: ${invite.role}.`,
		referenceType: "org_invite",
	});

	return c.json({ success: true });
});

orgRoutes.get("/:id/requests", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);
orgRoutes.post("/:id/requests", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);
orgRoutes.post("/:id/requests/:requestId/respond", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);

export { orgRoutes };
