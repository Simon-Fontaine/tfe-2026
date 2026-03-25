import {
	AddPlayerSchema,
	ArchiveTeamSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	InviteToTeamSchema,
	RespondToTeamInviteSchema,
	TeamScopedSchema,
	ToggleRecruitingSchema,
	UpdateTeamMemberPermissionSchema,
	UpdateTeamMemberSchema,
	UpdateTeamSchema,
} from "@scrimflow/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	lfgApplicationTable,
	lfgPostTable,
	organizationMemberTable,
	organizationTable,
	teamInviteTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { verifyOrgManager } from "@/utils/org";
import {
	ensureOrganizationMembership,
	ensureTeamMembership,
	getRecruitmentConversationsForUser,
	mapRecruitmentPost,
	mapRecruitmentResponse,
	mapTeamMember,
	normalizeMemberFields,
} from "@/utils/recruit";
import { getTeamAccessContext, getTeamById, isUserOnTeam } from "@/utils/team";

const teamRoutes = new Hono<AuthEnv>();

function getEffectiveInviteStatus(status: string, expiresAt: Date) {
	return status === "pending" && expiresAt < new Date() ? "expired" : status;
}

function toTeamPermissions(ctx: NonNullable<Awaited<ReturnType<typeof getTeamAccessContext>>>) {
	const orgCanManage = ctx.orgRole === "owner" || ctx.orgRole === "admin";

	return {
		orgRole: ctx.orgRole,
		teamPermissionRole: ctx.teamPermissionRole,
		canManage: ctx.canManageTeam,
		canManageAdmins: orgCanManage,
		canManageMembers: ctx.canManageTeam,
		canManageRoster: ctx.canManageTeam,
		canManageInvites: ctx.canManageTeam,
		canManagePosts: ctx.canManageTeam,
		canManageConversations: ctx.canManageTeam,
		canManageRequests: false,
		canManageSettings: ctx.canManageTeam,
		canLeave: ctx.teamMemberId !== null && ctx.teamStatus !== "inactive",
	};
}

async function getPendingResponses(teamId: string) {
	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.status, "pending"),
		with: {
			post: {
				columns: { id: true, type: true, title: true, teamId: true },
			},
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: { primaryRole: true, rank: true },
					},
				},
			},
			applicantTeam: {
				columns: { id: true, name: true, tag: true },
			},
			applicantOrganization: {
				columns: { id: true, name: true },
			},
			chatChannels: { columns: { id: true } },
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
	});

	return rows
		.filter((row) => row.post?.teamId === teamId)
		.map((row) => mapRecruitmentResponse(row));
}

async function getTeamWorkspaceDetail(teamId: string, userId: string) {
	const [team, access] = await Promise.all([
		getTeamById(teamId),
		getTeamAccessContext(teamId, userId),
	]);
	if (!team || !access || (!access.orgRole && !access.teamMemberId)) return null;

	const [organization, rosterRows, inviteRows, postRows, applications, conversations, orgAdmins] =
		await Promise.all([
			db.query.organizationTable.findFirst({
				where: eq(organizationTable.id, team.organizationId),
				columns: { id: true, name: true, slug: true },
			}),
			db.query.teamRosterTable.findMany({
				where: eq(teamRosterTable.teamId, teamId),
				with: {
					user: {
						columns: { id: true, displayName: true, avatarUrl: true },
						with: {
							profile: {
								columns: {
									primaryRole: true,
									rank: true,
									rankDivision: true,
								},
							},
						},
					},
				},
				orderBy: [asc(teamRosterTable.joinedAt)],
			}),
			db.query.teamInviteTable.findMany({
				where: eq(teamInviteTable.teamId, teamId),
				with: {
					invitee: {
						columns: { id: true, displayName: true, avatarUrl: true },
					},
				},
				orderBy: [desc(teamInviteTable.createdAt)],
			}),
			db.query.lfgPostTable.findMany({
				where: eq(lfgPostTable.teamId, teamId),
				with: {
					user: { columns: { id: true, displayName: true, avatarUrl: true } },
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
			getPendingResponses(teamId),
			getRecruitmentConversationsForUser(userId),
			db.query.organizationMemberTable.findMany({
				where: and(
					eq(organizationMemberTable.organizationId, team.organizationId),
					eq(organizationMemberTable.memberType, "staff")
				),
				with: {
					user: { columns: { id: true, displayName: true, avatarUrl: true } },
				},
			}),
		]);

	const members = rosterRows.map((row) => mapTeamMember(row));
	const adminsByUserId = new Map<
		string,
		{
			id: string;
			userId: string;
			displayName: string;
			avatarUrl: string | null;
			permissionRole: "admin" | "member";
			orgRole: "owner" | "admin" | "member" | null;
			source: "team" | "organization";
		}
	>();

	for (const row of orgAdmins.filter(
		(member) => member.role === "owner" || member.role === "admin"
	)) {
		adminsByUserId.set(row.user.id, {
			id: row.id,
			userId: row.user.id,
			displayName: row.user.displayName,
			avatarUrl: row.user.avatarUrl,
			permissionRole: "admin",
			orgRole: row.role,
			source: "organization",
		});
	}

	for (const row of members.filter(
		(member) => member.permissionRole === "admin" && member.status !== "inactive"
	)) {
		adminsByUserId.set(row.userId, {
			id: row.id,
			userId: row.userId,
			displayName: row.displayName,
			avatarUrl: row.avatarUrl,
			permissionRole: "admin",
			orgRole: null,
			source: "team",
		});
	}

	return {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: organization?.name ?? null,
		organizationSlug: organization?.slug ?? null,
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount: members.filter((member) => member.status !== "inactive").length,
		adminCount: adminsByUserId.size,
		currentUser: toTeamPermissions(access),
		members,
		players: members.filter((member) => member.memberType === "player"),
		staff: members.filter((member) => member.memberType === "staff"),
		roster: members,
		admins: [...adminsByUserId.values()],
		pendingInvites: inviteRows
			.map((invite) => {
				const normalized = normalizeMemberFields({
					memberType: invite.memberType,
					staffRole: invite.staffRole ?? null,
					roleInTeam: invite.roleInTeam ?? null,
				});

				return {
					id: invite.id,
					inviteeUserId: invite.invitee.id,
					inviteeDisplayName: invite.invitee.displayName,
					inviteeAvatarUrl: invite.invitee.avatarUrl,
					memberType: normalized.memberType,
					staffRole: normalized.staffRole,
					gameRole: normalized.gameRole,
					roleInTeam: normalized.roleInTeam,
					permissionRole: invite.permissionRole,
					status: getEffectiveInviteStatus(invite.status, invite.expiresAt),
					expiresAt: invite.expiresAt.toISOString(),
					createdAt: invite.createdAt.toISOString(),
					statusChangedAt: invite.updatedAt.toISOString(),
				};
			})
			.filter((invite) => invite.status === "pending"),
		pendingJoinRequests: [],
		ownedPosts: postRows.map((post) =>
			mapRecruitmentPost(post, {
				viewerId: userId,
				canManage: access.canManageTeam,
			})
		),
		conversations: conversations.filter((conversation) => conversation.teamId === teamId),
		applications,
		lfgPosts: postRows.map((post) =>
			mapRecruitmentPost(post, {
				viewerId: userId,
				canManage: access.canManageTeam,
			})
		),
	};
}

teamRoutes.get("/invites/received", async (c) => {
	const user = c.get("user");
	const rows = await db.query.teamInviteTable.findMany({
		where: eq(teamInviteTable.inviteeUserId, user.id),
		with: {
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true } },
			inviter: { columns: { displayName: true } },
		},
		orderBy: [desc(teamInviteTable.createdAt)],
	});

	return c.json({
		data: rows.map((row) => {
			const normalized = normalizeMemberFields({
				memberType: row.memberType,
				staffRole: row.staffRole ?? null,
				roleInTeam: row.roleInTeam ?? null,
			});

			return {
				id: row.id,
				teamId: row.team.id,
				teamName: row.team.name,
				teamTag: row.team.tag,
				teamAvatarUrl: row.team.avatarUrl,
				inviterDisplayName: row.inviter.displayName,
				memberType: normalized.memberType,
				staffRole: normalized.staffRole,
				gameRole: normalized.gameRole,
				roleInTeam: normalized.roleInTeam,
				permissionRole: row.permissionRole,
				status: getEffectiveInviteStatus(row.status, row.expiresAt),
				expiresAt: row.expiresAt.toISOString(),
				createdAt: row.createdAt.toISOString(),
				statusChangedAt: row.updatedAt.toISOString(),
			};
		}),
	});
});

teamRoutes.post("/invites/:id/respond", async (c) => {
	const user = c.get("user");
	const inviteId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToTeamInviteSchema, { ...body, inviteId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const invite = await db.query.teamInviteTable.findFirst({
		where: eq(teamInviteTable.id, inviteId),
		with: {
			team: { columns: { id: true, name: true, organizationId: true } },
		},
	});
	if (!invite) return c.json({ error: "Invite not found." }, 404);
	if (invite.inviteeUserId !== user.id)
		return c.json({ error: "This invite is not for you." }, 403);
	if (invite.status !== "pending")
		return c.json({ error: "This invite is no longer active." }, 400);
	if (invite.expiresAt < new Date()) return c.json({ error: "This invite has expired." }, 400);

	if (parsed.output.action === "accept") {
		const normalized = normalizeMemberFields({
			memberType: invite.memberType,
			staffRole: invite.staffRole ?? null,
			roleInTeam: invite.roleInTeam ?? null,
		});

		await db.transaction(async (tx) => {
			await ensureOrganizationMembership(tx, {
				organizationId: invite.team.organizationId,
				userId: user.id,
				role: "member",
				memberType: normalized.memberType,
				staffRole: normalized.staffRole,
				gameRole: normalized.gameRole,
			});

			await ensureTeamMembership(tx, {
				teamId: invite.teamId,
				userId: user.id,
				memberType: normalized.memberType,
				staffRole: normalized.staffRole,
				gameRole: normalized.gameRole,
				permissionRole: invite.permissionRole,
				status: "trial",
			});

			await tx
				.update(teamInviteTable)
				.set({ status: "accepted" })
				.where(eq(teamInviteTable.id, inviteId));
		});

		await createNotification({
			userId: invite.inviterUserId,
			type: "team_invite_accepted",
			title: `${invite.team.name} invite accepted`,
			referenceType: "team",
			referenceId: invite.teamId,
		});
	} else {
		await db
			.update(teamInviteTable)
			.set({ status: "declined" })
			.where(eq(teamInviteTable.id, inviteId));
	}

	return c.json({ success: true });
});

teamRoutes.get("/", async (c) => {
	const recruiting = c.req.query("recruiting");
	const recruitingFilter =
		recruiting === "true" ? true : recruiting === "false" ? false : undefined;

	const rows = await db.query.teamTable.findMany({
		where: and(
			eq(teamTable.isArchived, false),
			recruitingFilter !== undefined ? eq(teamTable.isRecruiting, recruitingFilter) : undefined
		),
		with: {
			roster: {
				columns: { id: true, status: true },
			},
			lfgPosts: {
				where: eq(lfgPostTable.status, "open"),
				columns: { id: true },
			},
		},
		orderBy: [asc(teamTable.name)],
		limit: 60,
	});

	return c.json({
		data: rows.map((team) => ({
			id: team.id,
			organizationId: team.organizationId,
			name: team.name,
			tag: team.tag,
			description: team.description ?? null,
			avatarUrl: team.avatarUrl,
			teamSr: team.teamSr,
			isRecruiting: team.isRecruiting,
			activeRosterCount: team.roster.filter((row) => row.status !== "inactive").length,
			openPostCount: team.lfgPosts.length,
		})),
	});
});

teamRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateTeamSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	if (!(await verifyOrgManager(parsed.output.orgId, user.id))) {
		return c.json(
			{ error: "You do not have permission to create teams in this organisation." },
			403
		);
	}

	const [team] = await db
		.insert(teamTable)
		.values({
			organizationId: parsed.output.orgId,
			name: parsed.output.name,
			tag: parsed.output.tag.toUpperCase(),
			description: parsed.output.description || null,
			avatarUrl: parsed.output.avatarUrl || null,
		})
		.returning({ id: teamTable.id });

	return c.json({ success: true, teamId: team.id });
});

teamRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const detail = await getTeamWorkspaceDetail(c.req.param("id"), user.id);
	if (!detail) return c.json({ error: "Team not found or inaccessible." }, 404);
	return c.json({ data: detail });
});

teamRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to edit this team." }, 403);

	await db
		.update(teamTable)
		.set({
			name: parsed.output.name,
			tag: parsed.output.tag.toUpperCase(),
			description: parsed.output.description || null,
			avatarUrl: parsed.output.avatarUrl || null,
		})
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

teamRoutes.patch("/:id/recruiting", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ToggleRecruitingSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(parsed.output.teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to manage this team." }, 403);

	const team = await getTeamById(teamId);
	if (!team) return c.json({ error: "Team not found." }, 404);

	await db
		.update(teamTable)
		.set({ isRecruiting: !team.isRecruiting })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

teamRoutes.post("/:id/archive", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ArchiveTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const team = await getTeamById(parsed.output.teamId);
	if (!team) return c.json({ error: "Team not found." }, 404);
	if (!(await verifyOrgManager(team.organizationId, user.id))) {
		return c.json({ error: "You do not have permission to archive this team." }, 403);
	}

	await db
		.update(teamTable)
		.set({ isArchived: true, isRecruiting: false })
		.where(eq(teamTable.id, team.id));

	return c.json({ success: true });
});

teamRoutes.post("/:id/unarchive", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(TeamScopedSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const team = await getTeamById(parsed.output.teamId);
	if (!team) return c.json({ error: "Team not found." }, 404);
	if (!(await verifyOrgManager(team.organizationId, user.id))) {
		return c.json({ error: "You do not have permission to restore this team." }, 403);
	}

	await db.update(teamTable).set({ isArchived: false }).where(eq(teamTable.id, team.id));

	return c.json({ success: true });
});

teamRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const team = await getTeamById(parsed.output.teamId);
	if (!team) return c.json({ error: "Team not found." }, 404);
	if (!(await verifyOrgManager(team.organizationId, user.id))) {
		return c.json({ error: "You do not have permission to delete this team." }, 403);
	}

	await db.delete(teamTable).where(eq(teamTable.id, team.id));

	return c.json({ success: true });
});

teamRoutes.get("/:id/applications", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam) return c.json({ data: [] });
	return c.json({ data: await getPendingResponses(access.teamId) });
});

teamRoutes.get("/:id/posts", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);

	const rows = await db.query.lfgPostTable.findMany({
		where: eq(lfgPostTable.teamId, teamId),
		with: {
			user: { columns: { id: true, displayName: true, avatarUrl: true } },
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
		orderBy: [desc(lfgPostTable.createdAt)],
	});

	return c.json({
		data: rows.map((row) =>
			mapRecruitmentPost(row, {
				viewerId: user.id,
				canManage: access.canManageTeam,
			})
		),
	});
});

teamRoutes.get("/:id/conversations", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam) return c.json({ data: [] });

	const conversations = await getRecruitmentConversationsForUser(user.id);
	return c.json({
		data: conversations.filter((conversation) => conversation.teamId === access.teamId),
	});
});

teamRoutes.delete("/:id/leave", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const roster = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, user.id)),
		columns: { id: true, status: true },
	});
	if (!roster) return c.json({ error: "You are not on this roster." }, 404);
	if (roster.status === "inactive")
		return c.json({ error: "You are no longer active on this roster." }, 400);

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, roster.id));

	return c.json({ success: true });
});

teamRoutes.post("/:id/roster", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(AddPlayerSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to manage this roster." }, 403);
	if (
		parsed.output.permissionRole === "admin" &&
		access.orgRole !== "owner" &&
		access.orgRole !== "admin"
	) {
		return c.json({ error: "Only org admins can grant team admin access." }, 403);
	}

	const normalized = normalizeMemberFields({
		memberType: parsed.output.memberType ?? null,
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? parsed.output.roleInTeam ?? null,
	});

	await db.transaction(async (tx) => {
		await ensureOrganizationMembership(tx, {
			organizationId: access.organizationId,
			userId: parsed.output.userId,
			role: "member",
			memberType: normalized.memberType,
			staffRole: normalized.staffRole,
			gameRole: normalized.gameRole,
		});

		await ensureTeamMembership(tx, {
			teamId,
			userId: parsed.output.userId,
			memberType: normalized.memberType,
			staffRole: normalized.staffRole,
			gameRole: normalized.gameRole,
			permissionRole: parsed.output.permissionRole ?? "member",
			status: parsed.output.status,
		});
	});

	return c.json({ success: true });
});

teamRoutes.patch("/:id/roster/:memberId", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const memberId = c.req.param("memberId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateTeamMemberSchema, { ...body, teamId, memberId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to manage this roster." }, 403);
	if (parsed.output.permissionRole && access.orgRole !== "owner" && access.orgRole !== "admin") {
		return c.json({ error: "Only org admins can change team admin access." }, 403);
	}

	const member = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, memberId),
		columns: { id: true, teamId: true },
	});
	if (!member || member.teamId !== teamId)
		return c.json({ error: "Roster member not found." }, 404);

	const normalized = normalizeMemberFields({
		memberType: parsed.output.memberType ?? null,
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? parsed.output.roleInTeam ?? null,
	});

	await db
		.update(teamRosterTable)
		.set({
			memberType: parsed.output.memberType ?? undefined,
			roleInTeam:
				parsed.output.gameRole !== undefined || parsed.output.roleInTeam !== undefined
					? normalized.roleInTeam
					: undefined,
			staffRole:
				parsed.output.memberType !== undefined ||
				parsed.output.staffRole !== undefined ||
				parsed.output.gameRole !== undefined ||
				parsed.output.roleInTeam !== undefined
					? normalized.staffRole
					: undefined,
			status: parsed.output.status ?? undefined,
			leftAt: parsed.output.status === "inactive" ? new Date() : undefined,
			permissionRole: parsed.output.permissionRole ?? undefined,
		})
		.where(eq(teamRosterTable.id, memberId));

	return c.json({ success: true });
});

teamRoutes.delete("/:id/roster/:memberId", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const memberId = c.req.param("memberId");

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to manage this roster." }, 403);

	const member = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, memberId),
		columns: { id: true, teamId: true },
	});
	if (!member || member.teamId !== teamId)
		return c.json({ error: "Roster member not found." }, 404);

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, memberId));

	return c.json({ success: true });
});

teamRoutes.patch("/:id/members/:memberId/role", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const memberId = c.req.param("memberId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateTeamMemberPermissionSchema, { ...body, teamId, memberId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (access.orgRole !== "owner" && access.orgRole !== "admin") {
		return c.json({ error: "Only org admins can change team admin assignments." }, 403);
	}

	const member = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, memberId),
		columns: { id: true, teamId: true },
	});
	if (!member || member.teamId !== teamId) return c.json({ error: "Team member not found." }, 404);

	await db
		.update(teamRosterTable)
		.set({ permissionRole: parsed.output.permissionRole })
		.where(eq(teamRosterTable.id, memberId));

	return c.json({ success: true });
});

teamRoutes.get("/:id/invites", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam) return c.json({ data: [] });

	const rows = await db.query.teamInviteTable.findMany({
		where: eq(teamInviteTable.teamId, access.teamId),
		with: {
			invitee: {
				columns: { id: true, displayName: true, avatarUrl: true },
			},
		},
		orderBy: [desc(teamInviteTable.createdAt)],
	});

	return c.json({
		data: rows
			.map((row) => {
				const normalized = normalizeMemberFields({
					memberType: row.memberType,
					staffRole: row.staffRole ?? null,
					roleInTeam: row.roleInTeam ?? null,
				});

				return {
					id: row.id,
					inviteeUserId: row.invitee.id,
					inviteeDisplayName: row.invitee.displayName,
					inviteeAvatarUrl: row.invitee.avatarUrl,
					memberType: normalized.memberType,
					staffRole: normalized.staffRole,
					gameRole: normalized.gameRole,
					roleInTeam: normalized.roleInTeam,
					permissionRole: row.permissionRole,
					status: getEffectiveInviteStatus(row.status, row.expiresAt),
					expiresAt: row.expiresAt.toISOString(),
					createdAt: row.createdAt.toISOString(),
					statusChangedAt: row.updatedAt.toISOString(),
				};
			})
			.filter((invite) => invite.status === "pending"),
	});
});

teamRoutes.post("/:id/invites", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(InviteToTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to invite members." }, 403);
	if (
		parsed.output.permissionRole === "admin" &&
		access.orgRole !== "owner" &&
		access.orgRole !== "admin"
	) {
		return c.json({ error: "Only org admins can invite team admins." }, 403);
	}
	if (await isUserOnTeam(parsed.output.userId, teamId)) {
		return c.json({ error: "This user is already on the team." }, 409);
	}

	const existingInvite = await db.query.teamInviteTable.findFirst({
		where: and(
			eq(teamInviteTable.teamId, teamId),
			eq(teamInviteTable.inviteeUserId, parsed.output.userId),
			eq(teamInviteTable.status, "pending")
		),
		columns: { id: true, expiresAt: true },
	});
	if (existingInvite && existingInvite.expiresAt > new Date()) {
		return c.json({ error: "An invite is already pending for this user." }, 409);
	}

	const team = await getTeamById(teamId);
	const normalized = normalizeMemberFields({
		memberType: parsed.output.memberType ?? null,
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? parsed.output.roleInTeam ?? null,
	});

	await db.insert(teamInviteTable).values({
		teamId,
		inviteeUserId: parsed.output.userId,
		inviterUserId: user.id,
		memberType: normalized.memberType,
		roleInTeam: normalized.roleInTeam,
		staffRole: normalized.staffRole,
		permissionRole: parsed.output.permissionRole ?? "member",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	});

	await createNotification({
		userId: parsed.output.userId,
		type: "team_invite_received",
		title: `You've been invited to join ${team?.name ?? "a team"}`,
		body: `Access: ${parsed.output.permissionRole ?? "member"}.`,
		referenceType: "team_invite",
	});

	return c.json({ success: true });
});

teamRoutes.delete("/:id/invites/:inviteId", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to cancel invites." }, 403);

	const invite = await db.query.teamInviteTable.findFirst({
		where: eq(teamInviteTable.id, inviteId),
		columns: { id: true, teamId: true, status: true, expiresAt: true },
	});
	if (!invite || invite.teamId !== teamId) return c.json({ error: "Invite not found." }, 404);
	if (getEffectiveInviteStatus(invite.status, invite.expiresAt) !== "pending") {
		return c.json({ error: "Only pending invites can be cancelled." }, 400);
	}

	await db
		.update(teamInviteTable)
		.set({ status: "cancelled" })
		.where(eq(teamInviteTable.id, inviteId));

	return c.json({ success: true });
});

teamRoutes.post("/:id/invites/:inviteId/resend", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const inviteId = c.req.param("inviteId");

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to resend invites." }, 403);

	const invite = await db.query.teamInviteTable.findFirst({
		where: eq(teamInviteTable.id, inviteId),
		with: { team: { columns: { name: true } } },
	});
	if (!invite || invite.teamId !== teamId) return c.json({ error: "Invite not found." }, 404);
	if (invite.status !== "pending")
		return c.json({ error: "Only pending invites can be resent." }, 400);

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await db.update(teamInviteTable).set({ expiresAt }).where(eq(teamInviteTable.id, inviteId));

	await createNotification({
		userId: invite.inviteeUserId,
		type: "team_invite_received",
		title: `You've been invited to join ${invite.team?.name ?? "a team"}`,
		body: `Access: ${invite.permissionRole}.`,
		referenceType: "team_invite",
	});

	return c.json({ success: true });
});

teamRoutes.get("/:id/requests", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);
teamRoutes.post("/:id/requests", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);
teamRoutes.post("/:id/requests/:requestId/respond", (c) =>
	c.json({ error: "Join requests have been removed. Use recruiting posts or direct invites." }, 410)
);

export { teamRoutes };
