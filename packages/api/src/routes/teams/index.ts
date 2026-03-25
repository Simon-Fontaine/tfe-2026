import {
	AddPlayerSchema,
	ArchiveTeamSchema,
	CreateTeamJoinRequestSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	InviteToTeamSchema,
	RespondToTeamInviteSchema,
	RespondToTeamJoinRequestSchema,
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
	teamJoinRequestTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { verifyOrgManager } from "@/utils/org";
import { getTeamAccessContext, getTeamById, isUserOnTeam } from "@/utils/team";

const teamRoutes = new Hono<AuthEnv>();

function getEffectiveInviteStatus(status: string, expiresAt: Date) {
	return status === "pending" && expiresAt < new Date() ? "expired" : status;
}

function toTeamPermissions(ctx: NonNullable<Awaited<ReturnType<typeof getTeamAccessContext>>>) {
	const orgCanManage = ctx.orgRole === "owner" || ctx.orgRole === "manager";

	return {
		orgRole: ctx.orgRole,
		teamPermissionRole: ctx.teamPermissionRole,
		canManage: ctx.canManageTeam,
		canManageAdmins: orgCanManage,
		canManageRoster: ctx.canManageTeam,
		canManageInvites: ctx.canManageTeam,
		canManageRequests: ctx.canManageTeam,
		canManageSettings: ctx.canManageTeam,
		canLeave: ctx.teamMemberId !== null && ctx.teamStatus !== "inactive",
	};
}

async function getPendingApplications(teamId: string) {
	const posts = await db.query.lfgPostTable.findMany({
		where: and(eq(lfgPostTable.teamId, teamId), eq(lfgPostTable.status, "open")),
		columns: { id: true },
	});

	if (posts.length === 0) return [];
	const postIds = new Set(posts.map((post) => post.id));

	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.status, "pending"),
		with: {
			post: { columns: { id: true } },
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: { primaryRole: true, rank: true },
					},
				},
			},
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
	});

	return rows
		.filter((row) => postIds.has(row.postId))
		.map((row) => ({
			id: row.id,
			postId: row.postId,
			status: row.status,
			message: row.message ?? null,
			createdAt: row.createdAt,
			applicantUserId: row.applicant.id,
			applicantDisplayName: row.applicant.displayName,
			applicantAvatarUrl: row.applicant.avatarUrl,
			applicantPrimaryRole: row.applicant.profile?.primaryRole ?? null,
			applicantRank: row.applicant.profile?.rank ?? null,
		}));
}

async function getTeamWorkspaceDetail(teamId: string, userId: string) {
	const [team, access] = await Promise.all([
		getTeamById(teamId),
		getTeamAccessContext(teamId, userId),
	]);
	if (!team || !access || !access.orgRole) return null;

	const [organization, rosterRows, teamAdmins, inviteRows, requestRows, applications, lfgPosts] =
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
			db.query.teamRosterTable.findMany({
				where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.permissionRole, "admin")),
				with: {
					user: { columns: { id: true, displayName: true, avatarUrl: true } },
				},
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
			db.query.teamJoinRequestTable.findMany({
				where: eq(teamJoinRequestTable.teamId, teamId),
				with: {
					requester: {
						columns: { id: true, displayName: true, avatarUrl: true },
						with: {
							profile: {
								columns: { primaryRole: true, rank: true },
							},
						},
					},
				},
				orderBy: [desc(teamJoinRequestTable.createdAt)],
			}),
			getPendingApplications(teamId),
			db.query.lfgPostTable.findMany({
				where: eq(lfgPostTable.teamId, teamId),
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
			}),
		]);

	const [ownerRows, managerRows] = await Promise.all([
		db.query.organizationMemberTable.findMany({
			where: and(
				eq(organizationMemberTable.organizationId, team.organizationId),
				eq(organizationMemberTable.role, "owner")
			),
			with: {
				user: { columns: { id: true, displayName: true, avatarUrl: true } },
			},
		}),
		db.query.organizationMemberTable.findMany({
			where: and(
				eq(organizationMemberTable.organizationId, team.organizationId),
				eq(organizationMemberTable.role, "manager")
			),
			with: {
				user: { columns: { id: true, displayName: true, avatarUrl: true } },
			},
		}),
	]);

	const adminsByUserId = new Map<
		string,
		{
			id: string;
			userId: string;
			displayName: string;
			avatarUrl: string | null;
			permissionRole: "admin" | "member";
			orgRole: "owner" | "manager" | null;
			source: "team" | "organization";
		}
	>();

	for (const row of ownerRows) {
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

	for (const row of managerRows) {
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

	for (const row of teamAdmins) {
		if (row.status === "inactive") continue;
		adminsByUserId.set(row.user.id, {
			id: row.id,
			userId: row.user.id,
			displayName: row.user.displayName,
			avatarUrl: row.user.avatarUrl,
			permissionRole: "admin",
			orgRole: null,
			source: "team",
		});
	}

	return {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: organization?.name ?? "Organisation",
		organizationSlug: organization?.slug ?? "",
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		teamSr: team.teamSr,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount: rosterRows.filter((row) => row.status !== "inactive").length,
		adminCount: adminsByUserId.size,
		currentUser: toTeamPermissions(access),
		roster: rosterRows.map((row) => ({
			id: row.id,
			userId: row.user.id,
			displayName: row.user.displayName,
			avatarUrl: row.user.avatarUrl,
			primaryRole: row.user.profile?.primaryRole ?? "damage",
			rank: row.user.profile?.rank ?? null,
			rankDivision: row.user.profile?.rankDivision ?? null,
			permissionRole: row.permissionRole,
			roleInTeam: row.roleInTeam,
			status: row.status,
			joinedAt: row.joinedAt,
			leftAt: row.leftAt,
			statusChangedAt: row.updatedAt,
		})),
		admins: [...adminsByUserId.values()],
		pendingInvites: inviteRows
			.map((row) => ({
				id: row.id,
				inviteeUserId: row.invitee.id,
				inviteeDisplayName: row.invitee.displayName,
				inviteeAvatarUrl: row.invitee.avatarUrl,
				roleInTeam: row.roleInTeam,
				permissionRole: row.permissionRole,
				status: getEffectiveInviteStatus(row.status, row.expiresAt),
				expiresAt: row.expiresAt,
				createdAt: row.createdAt,
				statusChangedAt: row.updatedAt,
			}))
			.filter((row) => row.status === "pending"),
		pendingJoinRequests: requestRows
			.map((row) => ({
				id: row.id,
				requesterUserId: row.requester.id,
				requesterDisplayName: row.requester.displayName,
				requesterAvatarUrl: row.requester.avatarUrl,
				requesterPrimaryRole: row.requester.profile?.primaryRole ?? null,
				requesterRank: row.requester.profile?.rank ?? null,
				requestedRoleInTeam: row.requestedRoleInTeam,
				message: row.message ?? null,
				status: row.status,
				createdAt: row.createdAt,
				statusChangedAt: row.updatedAt,
			}))
			.filter((row) => row.status === "pending"),
		applications,
		lfgPosts: lfgPosts.map((row) => ({
			id: row.id,
			type: row.type,
			status: row.status,
			rolesNeeded: (row.rolesNeeded as string[]) ?? [],
			minRank: row.minRank ?? null,
			maxRank: row.maxRank ?? null,
			description: row.description ?? null,
			region: row.region ?? null,
			expiresAt: row.expiresAt ?? null,
			createdAt: row.createdAt,
			userId: row.user.id,
			userDisplayName: row.user.displayName,
			userAvatarUrl: row.user.avatarUrl,
			teamId: row.team?.id ?? null,
			teamName: row.team?.name ?? null,
			teamTag: row.team?.tag ?? null,
			teamAvatarUrl: row.team?.avatarUrl ?? null,
			teamSr: row.team?.teamSr ?? null,
		})),
	};
}

teamRoutes.get("/invites/received", async (c) => {
	const user = c.get("user");
	const rows = await db.query.teamInviteTable.findMany({
		where: eq(teamInviteTable.inviteeUserId, user.id),
		with: {
			team: {
				columns: { id: true, name: true, tag: true, avatarUrl: true },
			},
			inviter: { columns: { displayName: true } },
		},
		orderBy: [desc(teamInviteTable.createdAt)],
	});

	return c.json({
		data: rows.map((row) => ({
			id: row.id,
			teamId: row.team.id,
			teamName: row.team.name,
			teamTag: row.team.tag,
			teamAvatarUrl: row.team.avatarUrl,
			inviterDisplayName: row.inviter.displayName,
			roleInTeam: row.roleInTeam,
			permissionRole: row.permissionRole,
			status: getEffectiveInviteStatus(row.status, row.expiresAt),
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			statusChangedAt: row.updatedAt,
		})),
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
		await db.transaction(async (tx) => {
			const existing = await tx.query.teamRosterTable.findFirst({
				where: and(eq(teamRosterTable.teamId, invite.teamId), eq(teamRosterTable.userId, user.id)),
				columns: { id: true },
			});

			if (existing) {
				await tx
					.update(teamRosterTable)
					.set({
						roleInTeam: invite.roleInTeam,
						permissionRole: invite.permissionRole,
						status: "trial",
						leftAt: null,
						joinedAt: new Date(),
					})
					.where(eq(teamRosterTable.id, existing.id));
			} else {
				await tx.insert(teamRosterTable).values({
					teamId: invite.teamId,
					userId: user.id,
					roleInTeam: invite.roleInTeam,
					permissionRole: invite.permissionRole,
					status: "trial",
					joinedAt: new Date(),
				});
			}

			const orgMembership = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, invite.team.organizationId),
					eq(organizationMemberTable.userId, user.id)
				),
				columns: { id: true },
			});
			if (!orgMembership) {
				await tx.insert(organizationMemberTable).values({
					organizationId: invite.team.organizationId,
					userId: user.id,
					role: "player",
				});
			}

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
	return c.json({ data: await getPendingApplications(access.teamId) });
});

teamRoutes.get("/:id/lfg", async (c) => {
	const teamId = c.req.param("id");
	const rows = await db.query.lfgPostTable.findMany({
		where: eq(lfgPostTable.teamId, teamId),
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
	});

	return c.json({
		data: rows.map((row) => ({
			id: row.id,
			type: row.type,
			status: row.status,
			rolesNeeded: (row.rolesNeeded as string[]) ?? [],
			minRank: row.minRank ?? null,
			maxRank: row.maxRank ?? null,
			description: row.description ?? null,
			region: row.region ?? null,
			expiresAt: row.expiresAt ?? null,
			createdAt: row.createdAt,
			userId: row.user.id,
			userDisplayName: row.user.displayName,
			userAvatarUrl: row.user.avatarUrl,
			teamId: row.team?.id ?? null,
			teamName: row.team?.name ?? null,
			teamTag: row.team?.tag ?? null,
			teamAvatarUrl: row.team?.avatarUrl ?? null,
			teamSr: row.team?.teamSr ?? null,
		})),
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
		access.orgRole !== "manager"
	) {
		return c.json({ error: "Only org admins can grant team admin access." }, 403);
	}

	await db.transaction(async (tx) => {
		const existing = await tx.query.teamRosterTable.findFirst({
			where: and(
				eq(teamRosterTable.teamId, teamId),
				eq(teamRosterTable.userId, parsed.output.userId)
			),
			columns: { id: true },
		});

		if (existing) {
			await tx
				.update(teamRosterTable)
				.set({
					roleInTeam: parsed.output.roleInTeam,
					permissionRole: parsed.output.permissionRole ?? "member",
					status: parsed.output.status,
					leftAt: null,
					joinedAt: new Date(),
				})
				.where(eq(teamRosterTable.id, existing.id));
		} else {
			await tx.insert(teamRosterTable).values({
				teamId,
				userId: parsed.output.userId,
				roleInTeam: parsed.output.roleInTeam,
				permissionRole: parsed.output.permissionRole ?? "member",
				status: parsed.output.status,
			});
		}

		const orgMembership = await tx.query.organizationMemberTable.findFirst({
			where: and(
				eq(organizationMemberTable.organizationId, access.organizationId),
				eq(organizationMemberTable.userId, parsed.output.userId)
			),
			columns: { id: true },
		});
		if (!orgMembership) {
			await tx.insert(organizationMemberTable).values({
				organizationId: access.organizationId,
				userId: parsed.output.userId,
				role: "player",
			});
		}
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
	if (parsed.output.permissionRole && access.orgRole !== "owner" && access.orgRole !== "manager") {
		return c.json({ error: "Only org admins can change team admin access." }, 403);
	}

	const member = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, memberId),
		columns: { id: true, teamId: true },
	});
	if (!member || member.teamId !== teamId)
		return c.json({ error: "Roster member not found." }, 404);

	const updates: Record<string, unknown> = {};
	if (parsed.output.roleInTeam) updates.roleInTeam = parsed.output.roleInTeam;
	if (parsed.output.status) {
		updates.status = parsed.output.status;
		updates.leftAt = parsed.output.status === "inactive" ? new Date() : null;
	}
	if (parsed.output.permissionRole) updates.permissionRole = parsed.output.permissionRole;

	await db.update(teamRosterTable).set(updates).where(eq(teamRosterTable.id, memberId));

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
	if (access.orgRole !== "owner" && access.orgRole !== "manager") {
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
			.map((row) => ({
				id: row.id,
				inviteeUserId: row.invitee.id,
				inviteeDisplayName: row.invitee.displayName,
				inviteeAvatarUrl: row.invitee.avatarUrl,
				roleInTeam: row.roleInTeam,
				permissionRole: row.permissionRole,
				status: getEffectiveInviteStatus(row.status, row.expiresAt),
				expiresAt: row.expiresAt,
				createdAt: row.createdAt,
				statusChangedAt: row.updatedAt,
			}))
			.filter((row) => row.status === "pending"),
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
		return c.json({ error: "You do not have permission to invite players." }, 403);
	if (
		parsed.output.permissionRole === "admin" &&
		access.orgRole !== "owner" &&
		access.orgRole !== "manager"
	) {
		return c.json({ error: "Only org admins can invite team admins." }, 403);
	}
	if (await isUserOnTeam(parsed.output.userId, teamId)) {
		return c.json({ error: "This player is already on the roster." }, 409);
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
		return c.json({ error: "An invite is already pending for this player." }, 409);
	}

	const team = await getTeamById(teamId);
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	await db.insert(teamInviteTable).values({
		teamId,
		inviteeUserId: parsed.output.userId,
		inviterUserId: user.id,
		roleInTeam: parsed.output.roleInTeam,
		permissionRole: parsed.output.permissionRole ?? "member",
		expiresAt,
	});

	await createNotification({
		userId: parsed.output.userId,
		type: "team_invite_received",
		title: `You've been invited to join ${team?.name ?? "a team"}`,
		body: `You were invited as ${parsed.output.roleInTeam}.`,
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
		body: `You were invited as ${invite.roleInTeam}.`,
		referenceType: "team_invite",
	});

	return c.json({ success: true });
});

teamRoutes.get("/:id/requests", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam) return c.json({ data: [] });

	const rows = await db.query.teamJoinRequestTable.findMany({
		where: eq(teamJoinRequestTable.teamId, access.teamId),
		with: {
			requester: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: { primaryRole: true, rank: true },
					},
				},
			},
		},
		orderBy: [desc(teamJoinRequestTable.createdAt)],
	});

	return c.json({
		data: rows
			.filter((row) => row.status === "pending")
			.map((row) => ({
				id: row.id,
				requesterUserId: row.requester.id,
				requesterDisplayName: row.requester.displayName,
				requesterAvatarUrl: row.requester.avatarUrl,
				requesterPrimaryRole: row.requester.profile?.primaryRole ?? null,
				requesterRank: row.requester.profile?.rank ?? null,
				requestedRoleInTeam: row.requestedRoleInTeam,
				message: row.message ?? null,
				status: row.status,
				createdAt: row.createdAt,
				statusChangedAt: row.updatedAt,
			})),
	});
});

teamRoutes.post("/:id/requests", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateTeamJoinRequestSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const team = await getTeamById(teamId);
	if (!team || team.isArchived) return c.json({ error: "Team not found." }, 404);
	if (await isUserOnTeam(user.id, teamId))
		return c.json({ error: "You are already on this roster." }, 409);

	const existing = await db.query.teamJoinRequestTable.findFirst({
		where: and(
			eq(teamJoinRequestTable.teamId, teamId),
			eq(teamJoinRequestTable.requesterUserId, user.id),
			eq(teamJoinRequestTable.status, "pending")
		),
		columns: { id: true },
	});
	if (existing) return c.json({ error: "You already have a pending team request." }, 409);

	await db.insert(teamJoinRequestTable).values({
		teamId,
		requesterUserId: user.id,
		requestedRoleInTeam: parsed.output.requestedRoleInTeam,
		message: parsed.output.message ?? null,
	});

	return c.json({ success: true });
});

teamRoutes.post("/:id/requests/:requestId/respond", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const requestId = c.req.param("requestId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToTeamJoinRequestSchema, { ...body, requestId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const request = await db.query.teamJoinRequestTable.findFirst({
		where: eq(teamJoinRequestTable.id, requestId),
		with: {
			team: { columns: { organizationId: true } },
		},
	});
	if (!request || request.teamId !== teamId) return c.json({ error: "Request not found." }, 404);
	if (request.status !== "pending")
		return c.json({ error: "This request is no longer active." }, 400);

	if (parsed.output.action === "cancel") {
		if (request.requesterUserId !== user.id) {
			return c.json({ error: "Only the requester can cancel this request." }, 403);
		}

		await db
			.update(teamJoinRequestTable)
			.set({ status: "cancelled" })
			.where(eq(teamJoinRequestTable.id, requestId));

		return c.json({ success: true });
	}

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to review requests." }, 403);

	if (parsed.output.action === "approve") {
		await db.transaction(async (tx) => {
			const existing = await tx.query.teamRosterTable.findFirst({
				where: and(
					eq(teamRosterTable.teamId, request.teamId),
					eq(teamRosterTable.userId, request.requesterUserId)
				),
				columns: { id: true },
			});

			if (existing) {
				await tx
					.update(teamRosterTable)
					.set({
						roleInTeam: request.requestedRoleInTeam,
						permissionRole: "member",
						status: "trial",
						leftAt: null,
						joinedAt: new Date(),
					})
					.where(eq(teamRosterTable.id, existing.id));
			} else {
				await tx.insert(teamRosterTable).values({
					teamId: request.teamId,
					userId: request.requesterUserId,
					roleInTeam: request.requestedRoleInTeam,
					permissionRole: "member",
					status: "trial",
				});
			}

			const orgMembership = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, request.team.organizationId),
					eq(organizationMemberTable.userId, request.requesterUserId)
				),
				columns: { id: true },
			});
			if (!orgMembership) {
				await tx.insert(organizationMemberTable).values({
					organizationId: request.team.organizationId,
					userId: request.requesterUserId,
					role: "player",
				});
			}

			await tx
				.update(teamJoinRequestTable)
				.set({ status: "approved" })
				.where(eq(teamJoinRequestTable.id, requestId));
		});
	} else {
		await db
			.update(teamJoinRequestTable)
			.set({ status: "rejected" })
			.where(eq(teamJoinRequestTable.id, requestId));
	}

	return c.json({ success: true });
});

export { teamRoutes };
