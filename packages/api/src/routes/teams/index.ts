import {
	ArchiveTeamSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	InviteToTeamSchema,
	RespondToTeamInviteSchema,
	TEAM_VIEWABLE_STATUSES,
	TeamScopedSchema,
	ToggleRecruitingSchema,
	UpdateTeamMemberPermissionSchema,
	UpdateTeamMemberSchema,
	UpdateTeamSchema,
} from "@scrimflow/shared";
import { and, asc, count, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	organizationMemberTable,
	organizationTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	teamInviteTable,
	teamRatingEventTable,
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
	mapRecruitmentApplication,
	mapRecruitmentListing,
	mapTeamMember,
	normalizeMemberFields,
} from "@/utils/recruit";
import { getTeamAccessContext, getTeamById } from "@/utils/team";
import {
	getTeamIdentityConstraintFieldErrors,
	getTeamIdentityFieldErrors,
	normalizeTeamIdentity,
} from "./identity";
import {
	getEffectiveInviteStatus,
	getRosterInviteConflictMessage,
	isActivePendingInvite,
	shouldPersistExpiredInvite,
} from "./invite-lifecycle";

const teamRoutes = new Hono<AuthEnv>();

function teamInviteLockKey(teamId: string, userId: string) {
	return `team-invite:${teamId}:${userId}`;
}

async function persistExpiredInvitesForTeam(teamId: string) {
	await db
		.update(teamInviteTable)
		.set({ status: "expired" })
		.where(
			and(
				eq(teamInviteTable.teamId, teamId),
				eq(teamInviteTable.status, "pending"),
				lt(teamInviteTable.expiresAt, new Date())
			)
		);
}

async function persistExpiredInvitesForUser(userId: string) {
	await db
		.update(teamInviteTable)
		.set({ status: "expired" })
		.where(
			and(
				eq(teamInviteTable.inviteeUserId, userId),
				eq(teamInviteTable.status, "pending"),
				lt(teamInviteTable.expiresAt, new Date())
			)
		);
}

async function persistExpiredInvite(inviteId: string) {
	await db
		.update(teamInviteTable)
		.set({ status: "expired" })
		.where(
			and(
				eq(teamInviteTable.id, inviteId),
				eq(teamInviteTable.status, "pending"),
				lt(teamInviteTable.expiresAt, new Date())
			)
		);
}

function isUniqueViolation(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "23505"
	);
}

function getConstraintName(error: unknown) {
	if (typeof error !== "object" || error === null || !("constraint" in error)) return undefined;
	const constraint = (error as { constraint?: unknown }).constraint;
	return typeof constraint === "string" ? constraint : undefined;
}

function getTeamIdentityConflictResponse(error: unknown) {
	if (!isUniqueViolation(error)) return null;
	const fieldErrors = getTeamIdentityConstraintFieldErrors(getConstraintName(error));
	if (!fieldErrors) return null;
	return {
		error: "A team with this identity already exists in this organization.",
		fieldErrors,
	};
}

async function findActiveTeamIdentityConflict(input: {
	orgId: string;
	name: string;
	tag: string;
	excludeTeamId?: string;
}) {
	const identity = normalizeTeamIdentity(input);
	const rows = await db.query.teamTable.findMany({
		where: and(
			eq(teamTable.organizationId, input.orgId),
			eq(teamTable.isArchived, false),
			input.excludeTeamId ? ne(teamTable.id, input.excludeTeamId) : undefined,
			or(
				sql`lower(${teamTable.name}) = ${identity.name.toLowerCase()}`,
				sql`upper(${teamTable.tag}) = ${identity.tag}`
			)
		),
		columns: { name: true, tag: true },
	});

	if (rows.length === 0) return null;
	return getTeamIdentityFieldErrors(identity, rows);
}

async function hasOtherActiveTeamAdmin(teamId: string, memberId: string) {
	const [row] = await db
		.select({ value: count() })
		.from(teamRosterTable)
		.where(
			and(
				eq(teamRosterTable.teamId, teamId),
				ne(teamRosterTable.id, memberId),
				eq(teamRosterTable.permissionRole, "admin"),
				ne(teamRosterTable.status, "inactive")
			)
		);

	return Number(row?.value ?? 0) > 0;
}

async function blocksLastActiveTeamAdmin(member: {
	id: string;
	teamId: string;
	permissionRole: "admin" | "member";
	status: "active" | "benched" | "trial" | "inactive";
	nextPermissionRole?: "admin" | "member";
	nextStatus?: "active" | "benched" | "trial" | "inactive";
}) {
	if (member.permissionRole !== "admin" || member.status === "inactive") return false;

	const nextPermissionRole = member.nextPermissionRole ?? member.permissionRole;
	const nextStatus = member.nextStatus ?? member.status;
	const remainsActiveAdmin = nextPermissionRole === "admin" && nextStatus !== "inactive";
	if (remainsActiveAdmin) return false;

	return !(await hasOtherActiveTeamAdmin(member.teamId, member.id));
}

function toTeamPermissions(ctx: NonNullable<Awaited<ReturnType<typeof getTeamAccessContext>>>) {
	const orgCanManage = ctx.orgRole === "owner" || ctx.orgRole === "admin";
	const hasViewableRosterStatus = ctx.teamStatus
		? TEAM_VIEWABLE_STATUSES.includes(ctx.teamStatus as (typeof TEAM_VIEWABLE_STATUSES)[number])
		: false;
	const canViewWorkspace = ctx.canManageTeam || hasViewableRosterStatus;
	const canViewSchedule = ctx.canManageTeam || ctx.teamStatus === "active";

	return {
		orgRole: ctx.orgRole,
		teamPermissionRole: ctx.teamPermissionRole,
		canManage: ctx.canManageTeam,
		canViewWorkspace,
		canViewRoster: canViewWorkspace,
		canViewSchedule,
		canViewScrims: canViewWorkspace,
		canViewRecruiting: canViewWorkspace,
		canViewChat: canViewWorkspace,
		canViewUpdates: canViewWorkspace,
		canManageAdmins: orgCanManage,
		canManageMembers: ctx.canManageTeam,
		canManageRoster: ctx.canManageTeam,
		canManageInvites: ctx.canManageTeam,
		canManageListings: ctx.canManageTeam,
		canManageConversations: ctx.canManageTeam,
		canManageSettings: ctx.canManageTeam,
		canLeave: ctx.teamMemberId !== null && ctx.teamStatus !== "inactive",
	};
}

async function getPendingRecruitmentApplications(teamId: string) {
	const rows = await db.query.recruitmentApplicationTable.findMany({
		where: eq(recruitmentApplicationTable.status, "pending"),
		with: {
			listing: {
				columns: { id: true, type: true, title: true, teamId: true },
			},
			applicant: {
				columns: { id: true, username: true, displayName: true, avatarUrl: true },
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
				columns: { id: true, name: true, slug: true },
			},
			chatChannels: { columns: { id: true } },
		},
		orderBy: [desc(recruitmentApplicationTable.createdAt)],
	});

	return rows
		.filter((row) => row.listing?.teamId === teamId)
		.map((row) => mapRecruitmentApplication(row));
}

async function getTeamWorkspaceDetail(teamId: string, userId: string) {
	const [team, access] = await Promise.all([
		getTeamById(teamId),
		getTeamAccessContext(teamId, userId),
	]);
	if (!team || !access) return null;
	const permissions = toTeamPermissions(access);
	if (!permissions.canViewWorkspace) return null;
	const canManageInvites = permissions.canManageInvites;
	const canManageListings = permissions.canManageListings;
	const canManageConversations = permissions.canManageConversations;

	await persistExpiredInvitesForTeam(teamId);

	const [
		organization,
		rosterRows,
		inviteRows,
		listingRows,
		applications,
		conversations,
		orgAdmins,
		ratingHistoryRows,
	] = await Promise.all([
		db.query.organizationTable.findFirst({
			where: eq(organizationTable.id, team.organizationId),
			columns: { id: true, name: true, slug: true },
		}),
		db.query.teamRosterTable.findMany({
			where: eq(teamRosterTable.teamId, teamId),
			with: {
				user: {
					columns: { id: true, username: true, displayName: true, avatarUrl: true },
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
		canManageInvites
			? db.query.teamInviteTable.findMany({
					where: eq(teamInviteTable.teamId, teamId),
					with: {
						invitee: {
							columns: { id: true, displayName: true, avatarUrl: true },
						},
					},
					orderBy: [desc(teamInviteTable.createdAt)],
				})
			: Promise.resolve([]),
		db.query.recruitmentListingTable.findMany({
			where: eq(recruitmentListingTable.teamId, teamId),
			with: {
				user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
				organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
				team: {
					columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true },
				},
				applications: {
					columns: { id: true, status: true, applicantUserId: true },
				},
			},
			orderBy: [desc(recruitmentListingTable.createdAt)],
		}),
		canManageListings ? getPendingRecruitmentApplications(teamId) : Promise.resolve([]),
		canManageConversations ? getRecruitmentConversationsForUser(userId) : Promise.resolve([]),
		db.query.organizationMemberTable.findMany({
			where: eq(organizationMemberTable.organizationId, team.organizationId),
			with: {
				user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
			},
		}),
		db.query.teamRatingEventTable.findMany({
			where: eq(teamRatingEventTable.teamId, teamId),
			with: {
				scrim: {
					columns: {
						id: true,
						homeTeamId: true,
						awayTeamId: true,
						homeMapScore: true,
						awayMapScore: true,
						scheduledAt: true,
					},
					with: {
						homeTeam: {
							columns: { id: true, name: true, tag: true },
						},
						awayTeam: {
							columns: { id: true, name: true, tag: true },
						},
					},
				},
			},
			orderBy: [desc(teamRatingEventTable.createdAt)],
			limit: 8,
		}),
	]);

	const members = rosterRows.map((row) => mapTeamMember(row));
	const adminsByUserId = new Map<
		string,
		{
			id: string;
			userId: string;
			username: string;
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
			username: row.user.username,
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
			username: row.username,
			displayName: row.displayName,
			avatarUrl: row.avatarUrl,
			permissionRole: "admin",
			orgRole: null,
			source: "team",
		});
	}

	const ratingHistory = ratingHistoryRows.map((event) => {
		const isHomeTeam = event.scrim.homeTeamId === teamId;
		const opponentTeam = isHomeTeam ? event.scrim.awayTeam : event.scrim.homeTeam;
		const teamMapScore = isHomeTeam ? event.scrim.homeMapScore : event.scrim.awayMapScore;
		const opponentMapScore = isHomeTeam ? event.scrim.awayMapScore : event.scrim.homeMapScore;
		const result =
			teamMapScore > opponentMapScore ? "win" : teamMapScore < opponentMapScore ? "loss" : "draw";

		return {
			id: event.id,
			scrimId: event.scrimId,
			opponentTeamId: opponentTeam?.id ?? null,
			opponentTeamName: opponentTeam?.name ?? null,
			opponentTeamTag: opponentTeam?.tag ?? null,
			teamMapScore,
			opponentMapScore,
			result,
			ratingBefore: event.ratingBefore,
			ratingAfter: event.ratingAfter,
			ratingDelta: event.ratingDelta,
			ratingDeviationBefore: event.ratingDeviationBefore ?? null,
			ratingDeviationAfter: event.ratingDeviationAfter ?? null,
			scheduledAt: event.scrim.scheduledAt?.toISOString() ?? null,
			createdAt: event.createdAt.toISOString(),
		};
	});

	return {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: organization?.name ?? null,
		organizationSlug: organization?.slug ?? null,
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		bannerUrl: team.bannerUrl ?? null,
		rating: team.rating,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		isPublic: team.isPublic,
		activeRosterCount: members.filter((member) => member.status !== "inactive").length,
		adminCount: adminsByUserId.size,
		currentUser: permissions,
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
		ownedListings: listingRows.map((listing) =>
			mapRecruitmentListing(canManageListings ? listing : { ...listing, applications: [] }, {
				viewerId: userId,
				canManage: canManageListings,
			})
		),
		conversations: conversations.filter((conversation) => conversation.teamId === teamId),
		applications,
		ratingHistory,
	};
}

teamRoutes.get("/invites/received", async (c) => {
	const user = c.get("user");
	await persistExpiredInvitesForUser(user.id);

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
	const effectiveStatus = getEffectiveInviteStatus(invite.status, invite.expiresAt);
	if (effectiveStatus === "expired") {
		await persistExpiredInvite(inviteId);
		return c.json({ error: "This invite has expired." }, 400);
	}
	if (effectiveStatus !== "pending")
		return c.json({ error: "This invite is no longer active." }, 400);

	if (parsed.output.action === "accept") {
		const normalized = normalizeMemberFields({
			memberType: invite.memberType,
			staffRole: invite.staffRole ?? null,
			roleInTeam: invite.roleInTeam ?? null,
		});

		const result = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${teamInviteLockKey(invite.teamId, user.id)}, 0))`
			);

			const lockedInvite = await tx.query.teamInviteTable.findFirst({
				where: eq(teamInviteTable.id, inviteId),
				columns: { status: true, expiresAt: true },
			});
			if (!lockedInvite) return { error: "Invite not found.", status: 404 };

			const lockedStatus = getEffectiveInviteStatus(lockedInvite.status, lockedInvite.expiresAt);
			if (lockedStatus === "expired") {
				await tx
					.update(teamInviteTable)
					.set({ status: "expired" })
					.where(eq(teamInviteTable.id, inviteId));
				return { error: "This invite has expired.", status: 400 };
			}
			if (lockedStatus !== "pending") {
				return { error: "This invite is no longer active.", status: 400 };
			}

			const existingRoster = await tx.query.teamRosterTable.findFirst({
				where: and(eq(teamRosterTable.teamId, invite.teamId), eq(teamRosterTable.userId, user.id)),
				columns: { status: true },
			});
			if (existingRoster) {
				return { error: getRosterInviteConflictMessage(existingRoster.status), status: 409 };
			}

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

			await tx
				.update(teamInviteTable)
				.set({ status: "cancelled" })
				.where(
					and(
						eq(teamInviteTable.teamId, invite.teamId),
						eq(teamInviteTable.inviteeUserId, user.id),
						eq(teamInviteTable.status, "pending"),
						ne(teamInviteTable.id, inviteId)
					)
				);

			return { success: true };
		});
		if ("error" in result) return c.json({ error: result.error }, result.status);

		await createNotification({
			userId: invite.inviterUserId,
			type: "team_invite_accepted",
			title: `${invite.team.name} invite accepted`,
			referenceType: "team",
			referenceId: invite.teamId,
		});
	} else {
		const result = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${teamInviteLockKey(invite.teamId, user.id)}, 0))`
			);

			const lockedInvite = await tx.query.teamInviteTable.findFirst({
				where: eq(teamInviteTable.id, inviteId),
				columns: { status: true, expiresAt: true },
			});
			if (!lockedInvite) return { error: "Invite not found.", status: 404 };

			const lockedStatus = getEffectiveInviteStatus(lockedInvite.status, lockedInvite.expiresAt);
			if (lockedStatus === "expired") {
				await tx
					.update(teamInviteTable)
					.set({ status: "expired" })
					.where(eq(teamInviteTable.id, inviteId));
				return { error: "This invite has expired.", status: 400 };
			}
			if (lockedStatus !== "pending") {
				return { error: "This invite is no longer active.", status: 400 };
			}

			await tx
				.update(teamInviteTable)
				.set({ status: "declined" })
				.where(eq(teamInviteTable.id, inviteId));

			return { success: true };
		});
		if ("error" in result) return c.json({ error: result.error }, result.status);
	}

	return c.json({
		success: true,
		teamId: invite.teamId,
		organizationId: invite.team.organizationId,
	});
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
			recruitmentListings: {
				where: eq(recruitmentListingTable.status, "open"),
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
			bannerUrl: team.bannerUrl ?? null,
			rating: team.rating,
			isRecruiting: team.isRecruiting,
			activeRosterCount: team.roster.filter((row) => row.status !== "inactive").length,
			openListingCount: team.recruitmentListings.length,
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

	const identity = normalizeTeamIdentity({
		name: parsed.output.name,
		tag: parsed.output.tag,
	});
	const conflict = await findActiveTeamIdentityConflict({
		orgId: parsed.output.orgId,
		...identity,
	});
	if (conflict) {
		return c.json(
			{
				error: "A team with this identity already exists in this organization.",
				fieldErrors: conflict,
			},
			409
		);
	}

	try {
		const team = await db.transaction(async (tx) => {
			const [createdTeam] = await tx
				.insert(teamTable)
				.values({
					organizationId: parsed.output.orgId,
					name: identity.name,
					tag: identity.tag,
					description: parsed.output.description || null,
					avatarUrl: parsed.output.avatarUrl || null,
					bannerUrl: parsed.output.bannerUrl || null,
					isPublic: parsed.output.isPublic ?? true,
				})
				.returning({ id: teamTable.id });

			await ensureTeamMembership(tx, {
				teamId: createdTeam.id,
				userId: user.id,
				memberType: "staff",
				staffRole: "manager",
				permissionRole: "admin",
				status: "active",
			});

			return createdTeam;
		});

		return c.json({ success: true, teamId: team.id });
	} catch (error) {
		const conflictResponse = getTeamIdentityConflictResponse(error);
		if (conflictResponse) return c.json(conflictResponse, 409);
		throw error;
	}
});

teamRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const detail = await getTeamWorkspaceDetail(teamId, user.id);
	if (!detail) {
		const team = await getTeamById(teamId);
		if (team) return c.json({ error: "You do not have access to this team workspace." }, 403);
		return c.json({ error: "Team not found." }, 404);
	}
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

	const identity = normalizeTeamIdentity({
		name: parsed.output.name,
		tag: parsed.output.tag,
	});
	const conflict = await findActiveTeamIdentityConflict({
		orgId: access.organizationId,
		...identity,
		excludeTeamId: teamId,
	});
	if (conflict) {
		return c.json(
			{
				error: "A team with this identity already exists in this organization.",
				fieldErrors: conflict,
			},
			409
		);
	}

	try {
		await db
			.update(teamTable)
			.set({
				name: identity.name,
				tag: identity.tag,
				description: parsed.output.description || null,
				avatarUrl: parsed.output.avatarUrl || null,
				bannerUrl: parsed.output.bannerUrl || null,
				...(parsed.output.isPublic === undefined ? {} : { isPublic: parsed.output.isPublic }),
			})
			.where(eq(teamTable.id, teamId));
	} catch (error) {
		const conflictResponse = getTeamIdentityConflictResponse(error);
		if (conflictResponse) return c.json(conflictResponse, 409);
		throw error;
	}

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

	const conflict = await findActiveTeamIdentityConflict({
		orgId: team.organizationId,
		name: team.name,
		tag: team.tag,
		excludeTeamId: team.id,
	});
	if (conflict) {
		return c.json(
			{
				error: "A team with this identity already exists in this organization.",
				fieldErrors: conflict,
			},
			409
		);
	}

	try {
		await db.update(teamTable).set({ isArchived: false }).where(eq(teamTable.id, team.id));
	} catch (error) {
		const conflictResponse = getTeamIdentityConflictResponse(error);
		if (conflictResponse) return c.json(conflictResponse, 409);
		throw error;
	}

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

teamRoutes.get("/:id/recruitment/applications", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!toTeamPermissions(access).canManageListings) {
		return c.json({ error: "You do not have permission to review team applications." }, 403);
	}
	return c.json({ data: await getPendingRecruitmentApplications(access.teamId) });
});

teamRoutes.get("/:id/recruitment/listings", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");
	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	const permissions = toTeamPermissions(access);
	if (!permissions.canViewRecruiting) {
		return c.json({ error: "You do not have access to this team's recruiting workspace." }, 403);
	}

	const rows = await db.query.recruitmentListingTable.findMany({
		where: eq(recruitmentListingTable.teamId, teamId),
		with: {
			user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
		orderBy: [desc(recruitmentListingTable.createdAt)],
	});

	return c.json({
		data: rows.map((row) =>
			mapRecruitmentListing(row, {
				viewerId: user.id,
				canManage: permissions.canManageListings,
			})
		),
	});
});

teamRoutes.get("/:id/recruitment/conversations", async (c) => {
	const user = c.get("user");
	const access = await getTeamAccessContext(c.req.param("id"), user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!toTeamPermissions(access).canManageConversations) {
		return c.json({ error: "You do not have permission to review team conversations." }, 403);
	}

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
		columns: { id: true, teamId: true, permissionRole: true, status: true },
	});
	if (!roster) return c.json({ error: "You are not on this roster." }, 404);
	if (roster.status === "inactive")
		return c.json({ error: "You are no longer active on this roster." }, 400);
	if (await blocksLastActiveTeamAdmin({ ...roster, nextStatus: "inactive" })) {
		return c.json({ error: "Assign another active team admin before leaving this team." }, 409);
	}

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, roster.id));

	return c.json({ success: true });
});

teamRoutes.post("/:id/roster", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam)
		return c.json({ error: "You do not have permission to manage this roster." }, 403);

	return c.json({ error: "Direct roster adds are disabled. Send a team invite instead." }, 409);
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
		columns: { id: true, teamId: true, permissionRole: true, status: true },
	});
	if (!member || member.teamId !== teamId)
		return c.json({ error: "Roster member not found." }, 404);

	const normalized = normalizeMemberFields({
		memberType: parsed.output.memberType ?? null,
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? parsed.output.roleInTeam ?? null,
	});
	if (
		await blocksLastActiveTeamAdmin({
			...member,
			nextPermissionRole: parsed.output.permissionRole,
			nextStatus: parsed.output.status,
		})
	) {
		return c.json(
			{ error: "Assign another active team admin before changing this admin's access." },
			409
		);
	}

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
			leftAt:
				parsed.output.status === "inactive" ? new Date() : parsed.output.status ? null : undefined,
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
		columns: { id: true, teamId: true, permissionRole: true, status: true },
	});
	if (!member || member.teamId !== teamId)
		return c.json({ error: "Roster member not found." }, 404);
	if (await blocksLastActiveTeamAdmin({ ...member, nextStatus: "inactive" })) {
		return c.json({ error: "Assign another active team admin before removing this admin." }, 409);
	}

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
		columns: { id: true, teamId: true, permissionRole: true, status: true },
	});
	if (!member || member.teamId !== teamId) return c.json({ error: "Team member not found." }, 404);
	if (
		await blocksLastActiveTeamAdmin({
			...member,
			nextPermissionRole: parsed.output.permissionRole,
		})
	) {
		return c.json(
			{ error: "Assign another active team admin before changing this admin's access." },
			409
		);
	}

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

	await persistExpiredInvitesForTeam(access.teamId);

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
	const team = await getTeamById(teamId);
	const normalized = normalizeMemberFields({
		memberType: parsed.output.memberType ?? null,
		staffRole: parsed.output.staffRole ?? null,
		gameRole: parsed.output.gameRole ?? parsed.output.roleInTeam ?? null,
	});

	const result = await db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${teamInviteLockKey(teamId, parsed.output.userId)}, 0))`
		);

		const existingRoster = await tx.query.teamRosterTable.findFirst({
			where: and(
				eq(teamRosterTable.teamId, teamId),
				eq(teamRosterTable.userId, parsed.output.userId)
			),
			columns: { status: true },
		});
		if (existingRoster) {
			return { error: getRosterInviteConflictMessage(existingRoster.status), status: 409 };
		}

		const existingInvites = await tx.query.teamInviteTable.findMany({
			where: and(
				eq(teamInviteTable.teamId, teamId),
				eq(teamInviteTable.inviteeUserId, parsed.output.userId),
				eq(teamInviteTable.status, "pending")
			),
			columns: { id: true, expiresAt: true },
		});
		const activeInvite = existingInvites.find((invite) =>
			isActivePendingInvite("pending", invite.expiresAt)
		);
		if (activeInvite) {
			return { error: "An invite is already pending for this user.", status: 409 };
		}
		const expiredInviteIds = existingInvites
			.filter((invite) => shouldPersistExpiredInvite("pending", invite.expiresAt))
			.map((invite) => invite.id);

		if (expiredInviteIds.length > 0) {
			await tx
				.update(teamInviteTable)
				.set({ status: "expired" })
				.where(or(...expiredInviteIds.map((id) => eq(teamInviteTable.id, id))));
		}

		const [createdInvite] = await tx
			.insert(teamInviteTable)
			.values({
				teamId,
				inviteeUserId: parsed.output.userId,
				inviterUserId: user.id,
				memberType: normalized.memberType,
				roleInTeam: normalized.roleInTeam,
				staffRole: normalized.staffRole,
				permissionRole: parsed.output.permissionRole ?? "member",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			})
			.returning({ id: teamInviteTable.id });

		return { inviteId: createdInvite.id };
	});
	if ("error" in result) return c.json({ error: result.error }, result.status);

	await createNotification({
		userId: parsed.output.userId,
		type: "team_invite_received",
		title: `You've been invited to join ${team?.name ?? "a team"}`,
		body: `Access: ${parsed.output.permissionRole ?? "member"}.`,
		referenceType: "team_invite",
		referenceId: teamId,
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
	if (!isActivePendingInvite(invite.status, invite.expiresAt)) {
		await persistExpiredInvite(inviteId);
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
	if (!isActivePendingInvite(invite.status, invite.expiresAt)) {
		await persistExpiredInvite(inviteId);
		return c.json({ error: "Only pending invites can be resent." }, 400);
	}

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await db.update(teamInviteTable).set({ expiresAt }).where(eq(teamInviteTable.id, inviteId));

	await createNotification({
		userId: invite.inviteeUserId,
		type: "team_invite_received",
		title: `You've been invited to join ${invite.team?.name ?? "a team"}`,
		body: `Access: ${invite.permissionRole}.`,
		referenceType: "team_invite",
		referenceId: teamId,
	});

	return c.json({ success: true });
});

export { teamRoutes };
