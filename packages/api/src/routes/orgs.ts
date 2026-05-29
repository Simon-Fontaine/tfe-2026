import {
	CancelOwnershipWorkflowSchema,
	CreateOrgSchema,
	canAssignOrgRole,
	DeleteOrgSchema,
	InitiateOwnershipWorkflowSchema,
	InviteToOrgSchema,
	isReservedIdentityValue,
	LifecycleArchiveSchema,
	LifecycleDeletionCancelSchema,
	LifecycleRestoreSchema,
	LifecycleSettlementSchema,
	ResolveOwnershipWorkflowSchema,
	RespondToOrgInviteSchema,
	RespondToOwnershipWorkflowSchema,
	rateLimits,
	TEAM_VIEWABLE_STATUSES,
	UpdateOrgMemberSchema,
	UpdateOrgSchema,
} from "@scrimflow/shared";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createElement } from "react";
import * as v from "valibot";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/auth/sensitive-action";
import { db } from "@/db";
import {
	availabilityTable,
	chatChannelTable,
	lifecycleWorkflowTable,
	organizationMemberTable,
	organizationTable,
	orgInviteTable,
	ownershipWorkflowEventTable,
	ownershipWorkflowTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	scrimTable,
	teamInviteTable,
	teamRosterTable,
	teamTable,
	updatePostTable,
} from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { createNotification } from "@/notifications";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { extractErrors } from "@/routes/auth/utils";
import {
	getCurrentLifecycleWorkflow,
	getLifecycleMutationBlockReason,
	getLifecycleRecoveryUntil,
	mapLifecycleWorkflow,
} from "@/utils/lifecycle";
import logger from "@/utils/logger";
import { findOrgBySlug, getOrgPermissions, getUserOrgRole, nameToSlug } from "@/utils/org";
import {
	getCurrentOwnershipWorkflow,
	getOwnershipResolution,
	mapOwnershipWorkflow,
	persistExpiredOwnershipWorkflows,
} from "@/utils/ownership";
import {
	ensureOrganizationMembership,
	getRecruitmentConversationsForUser,
	mapRecruitmentListing,
} from "@/utils/recruit";
import { buildOrgTeamOversight, type OrgTeamOversightInput } from "./orgs/oversight";

const orgRoutes = new Hono<AuthEnv & RequestContextEnv>();

type QueryResult<T> = { data: T; failed: boolean };

function getEffectiveInviteStatus(status: string, expiresAt: Date) {
	return status === "pending" && expiresAt < new Date() ? "expired" : status;
}

async function safeOrgSummaryQuery<T>(
	promise: Promise<T>,
	fallback: T,
	context: Record<string, unknown>,
	message: string
): Promise<QueryResult<T>> {
	try {
		return { data: await promise, failed: false };
	} catch (err) {
		logger.error({ err, ...context }, message);
		return { data: fallback, failed: true };
	}
}

async function getOrgLifecycleBlock(orgId: string) {
	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { lifecycleStatus: true },
	});
	return getLifecycleMutationBlockReason("Organization", org?.lifecycleStatus);
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
		rating: number;
		matchesPlayed: number;
		isRecruiting: boolean;
		isArchived: boolean;
		lifecycleStatus: string;
		isPublic: boolean;
		roster: Array<{ userId: string; permissionRole: "admin" | "member"; status: string }>;
	},
	oversight?: OrgTeamOversightInput
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
		rating: team.rating,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		lifecycleStatus: team.lifecycleStatus as
			| "active"
			| "archived"
			| "deletion_pending"
			| "irreversible",
		lifecycleWorkflow: null,
		isPublic: team.isPublic,
		activeRosterCount,
		adminCount,
		...(oversight ? { oversight: buildOrgTeamOversight(oversight) } : {}),
	};
}

function incrementCount(map: Map<string, number>, key: string | null | undefined, amount = 1) {
	if (!key) return;
	map.set(key, (map.get(key) ?? 0) + amount);
}

function setLatestDate(
	map: Map<string, string>,
	key: string | null | undefined,
	value: Date | null
) {
	if (!key || !value) return;
	const iso = value.toISOString();
	const current = map.get(key);
	if (!current || new Date(iso).getTime() > new Date(current).getTime()) {
		map.set(key, iso);
	}
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

function getOrgIdentityConflictResponse(error: unknown) {
	if (!isUniqueViolation(error)) return null;
	const constraint = getConstraintName(error);
	if (constraint === "organization_slug_idx") {
		return {
			error: "Organization identity is unavailable.",
			fieldErrors: { slug: ["Another organization already uses this slug."] },
		};
	}
	if (constraint === "organization_name_unique_idx") {
		return {
			error: "Organization identity is unavailable.",
			fieldErrors: { name: ["Another organization already uses this name."] },
		};
	}
	return null;
}

async function getOrgIdentityFieldErrors(input: {
	name: string;
	slug: string;
	ignoreOrgId?: string;
}) {
	const fieldErrors: Partial<Record<"name" | "slug", string[]>> = {};

	if (isReservedIdentityValue(input.name)) {
		fieldErrors.name = [
			"This organization name is unavailable. Choose a different public identity.",
		];
	}
	if (isReservedIdentityValue(input.slug)) {
		fieldErrors.slug = [
			"This organization slug is unavailable. Choose a different public identity.",
		];
	}
	if (Object.keys(fieldErrors).length > 0) return fieldErrors;

	const nameConflict = await db.query.organizationTable.findFirst({
		where: input.ignoreOrgId
			? and(
					sql`lower(${organizationTable.name}) = ${input.name.toLowerCase()}`,
					ne(organizationTable.id, input.ignoreOrgId)
				)
			: sql`lower(${organizationTable.name}) = ${input.name.toLowerCase()}`,
		columns: { id: true },
	});
	if (nameConflict) {
		fieldErrors.name = ["Another organization already uses this name."];
	}

	const slugConflict = await findOrgBySlug(input.slug, input.ignoreOrgId);
	if (slugConflict) {
		fieldErrors.slug = ["Another organization already uses this slug."];
	}

	return fieldErrors;
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
			website: true,
			discord: true,
			twitter: true,
			isPublic: true,
			lifecycleStatus: true,
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
					rating: true,
					matchesPlayed: true,
					isRecruiting: true,
					isArchived: true,
					lifecycleStatus: true,
					isPublic: true,
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

	const teamIds = org.teams.map((team) => team.id);
	const canViewOperationalHealth = permissions.canManageTeams;

	const [
		inviteRows,
		listingRows,
		conversations,
		teamInviteResult,
		availabilityResult,
		scrimResult,
		updateResult,
		ownershipWorkflow,
		lifecycleWorkflow,
	] = await Promise.all([
		permissions.canManageInvites
			? db.query.orgInviteTable.findMany({
					where: eq(orgInviteTable.organizationId, orgId),
					with: {
						invitee: { columns: { id: true, displayName: true, avatarUrl: true } },
					},
					orderBy: [desc(orgInviteTable.createdAt)],
				})
			: Promise.resolve([]),
		db.query.recruitmentListingTable.findMany({
			where: eq(recruitmentListingTable.organizationId, orgId),
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
		getRecruitmentConversationsForUser(userId).catch((err: unknown) => {
			logger.error(
				{ err, orgId, userId },
				"failed to load recruitment conversations for org workspace"
			);
			return [];
		}),
		canViewOperationalHealth && teamIds.length > 0
			? safeOrgSummaryQuery(
					db.query.teamInviteTable.findMany({
						where: and(
							inArray(teamInviteTable.teamId, teamIds),
							eq(teamInviteTable.status, "pending")
						),
						columns: { id: true, teamId: true, status: true, expiresAt: true },
					}),
					[],
					{ orgId },
					"failed to load org team invite summary"
				)
			: Promise.resolve({ data: [], failed: false }),
		canViewOperationalHealth && teamIds.length > 0
			? safeOrgSummaryQuery(
					db.query.availabilityTable.findMany({
						where: inArray(availabilityTable.teamId, teamIds),
						columns: { id: true, teamId: true },
					}),
					[],
					{ orgId },
					"failed to load org availability summary"
				)
			: Promise.resolve({ data: [], failed: false }),
		canViewOperationalHealth && teamIds.length > 0
			? safeOrgSummaryQuery(
					db.query.scrimTable.findMany({
						where: or(
							inArray(scrimTable.homeTeamId, teamIds),
							inArray(scrimTable.awayTeamId, teamIds)
						),
						columns: {
							id: true,
							homeTeamId: true,
							awayTeamId: true,
							status: true,
							scheduledAt: true,
							updatedAt: true,
						},
					}),
					[],
					{ orgId },
					"failed to load org scrim summary"
				)
			: Promise.resolve({ data: [], failed: false }),
		canViewOperationalHealth && teamIds.length > 0
			? safeOrgSummaryQuery(
					db.query.updatePostTable.findMany({
						where: inArray(updatePostTable.teamId, teamIds),
						columns: { id: true, teamId: true, createdAt: true },
						orderBy: [desc(updatePostTable.createdAt)],
					}),
					[],
					{ orgId },
					"failed to load org update summary"
				)
			: Promise.resolve({ data: [], failed: false }),
		permissions.canManageSettings
			? getCurrentOwnershipWorkflow("organization", orgId)
			: Promise.resolve(null),
		permissions.canManageSettings
			? getCurrentLifecycleWorkflow("organization", orgId)
			: Promise.resolve(null),
	]);

	const teamInviteRows = teamInviteResult.data;
	const availabilityRows = availabilityResult.data;
	const scrimRows = scrimResult.data;
	const updateRows = updateResult.data;
	const summaryState: OrgTeamOversightInput["summaryState"] = [
		teamInviteResult,
		availabilityResult,
		scrimResult,
		updateResult,
	].some((result) => result.failed)
		? canViewOperationalHealth
			? "partial-failed"
			: "unavailable"
		: "loaded";

	const pendingTeamInviteCountByTeam = new Map<string, number>();
	for (const invite of teamInviteRows) {
		if (getEffectiveInviteStatus(invite.status, invite.expiresAt) === "pending") {
			incrementCount(pendingTeamInviteCountByTeam, invite.teamId);
		}
	}

	const openListingCountByTeam = new Map<string, number>();
	const pendingApplicationCountByTeam = new Map<string, number>();
	for (const listing of listingRows) {
		if (!listing.teamId || listing.status !== "open") continue;
		incrementCount(openListingCountByTeam, listing.teamId);
		incrementCount(
			pendingApplicationCountByTeam,
			listing.teamId,
			listing.applications.filter((application) => application.status === "pending").length
		);
	}

	const availabilityCountByTeam = new Map<string, number>();
	for (const availability of availabilityRows) {
		incrementCount(availabilityCountByTeam, availability.teamId);
	}

	const now = new Date();
	const recentSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const upcomingScrimCountByTeam = new Map<string, number>();
	const recentScrimCountByTeam = new Map<string, number>();
	const latestScrimAtByTeam = new Map<string, string>();
	for (const scrim of scrimRows) {
		const keys = [scrim.homeTeamId, scrim.awayTeamId].filter((teamId): teamId is string =>
			teamIds.includes(teamId ?? "")
		);
		const relevantDate = scrim.scheduledAt ?? scrim.updatedAt;
		for (const key of keys) {
			if (
				scrim.scheduledAt &&
				scrim.scheduledAt >= now &&
				(scrim.status === "pending" || scrim.status === "accepted" || scrim.status === "scheduled")
			) {
				incrementCount(upcomingScrimCountByTeam, key);
			}
			if (relevantDate && relevantDate >= recentSince) {
				incrementCount(recentScrimCountByTeam, key);
			}
			setLatestDate(latestScrimAtByTeam, key, relevantDate);
		}
	}

	const latestUpdateAtByTeam = new Map<string, string>();
	for (const update of updateRows) {
		setLatestDate(latestUpdateAtByTeam, update.teamId, update.createdAt);
	}

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

	const members = org.members.flatMap((member) => {
		const user = member.user as typeof member.user | null;
		if (!user) {
			logger.warn({ orgId, memberId: member.id }, "skipping org member with missing user");
			return [];
		}

		return [
			{
				id: member.id,
				userId: user.id,
				username: user.username,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl,
				permissionRole: member.role,
				role: member.role,
				memberType: member.memberType,
				staffRole: member.staffRole ?? null,
				gameRole: member.gameRole ?? null,
				activeTeamCount: activeTeamCountsByUser.get(user.id) ?? 0,
				joinedAt: member.createdAt.toISOString(),
			},
		];
	});

	const pendingInvites = inviteRows
		.flatMap((invite) => {
			const invitee = invite.invitee as typeof invite.invitee | null;
			if (!invitee) {
				logger.warn({ orgId, inviteId: invite.id }, "skipping org invite with missing invitee");
				return [];
			}

			return [
				{
					id: invite.id,
					inviteeUserId: invitee.id,
					inviteeDisplayName: invitee.displayName,
					inviteeAvatarUrl: invitee.avatarUrl,
					permissionRole: invite.role,
					role: invite.role,
					memberType: invite.memberType,
					staffRole: invite.staffRole ?? null,
					gameRole: invite.gameRole ?? null,
					status: getEffectiveInviteStatus(invite.status, invite.expiresAt),
					expiresAt: invite.expiresAt.toISOString(),
					createdAt: invite.createdAt.toISOString(),
					statusChangedAt: invite.updatedAt.toISOString(),
				},
			];
		})
		.filter((invite) => invite.status === "pending");

	const ownedListings = listingRows.flatMap((listing) => {
		const owner = listing.user as typeof listing.user | null;
		if (!owner) {
			logger.warn(
				{ orgId, listingId: listing.id },
				"skipping org recruitment listing with missing owner"
			);
			return [];
		}

		return [
			mapRecruitmentListing(
				{
					...listing,
					user: owner,
					applications: permissions.canManage ? listing.applications : [],
				},
				{
					viewerId: userId,
					canManage: permissions.canManage,
				}
			),
		];
	});

	const oversightForTeam = (team: (typeof org.teams)[number]): OrgTeamOversightInput => {
		const hasActiveViewerRoster = team.roster.some(
			(member) => member.userId === userId && member.status !== "inactive"
		);
		const canOpenWorkspace = permissions.canManageTeams || hasActiveViewerRoster;
		const activeRosterCount = team.roster.filter((member) => member.status !== "inactive").length;
		const adminCount = new Set(
			team.roster
				.filter((member) => member.status !== "inactive" && member.permissionRole === "admin")
				.map((member) => member.userId)
		).size;

		return {
			isArchived: team.isArchived,
			isPublic: team.isPublic,
			activeRosterCount,
			adminCount,
			pendingInviteCount: pendingTeamInviteCountByTeam.get(team.id) ?? 0,
			openListingCount: openListingCountByTeam.get(team.id) ?? 0,
			pendingApplicationCount: pendingApplicationCountByTeam.get(team.id) ?? 0,
			availabilityCount: availabilityCountByTeam.get(team.id) ?? 0,
			upcomingScrimCount: upcomingScrimCountByTeam.get(team.id) ?? 0,
			recentScrimCount: recentScrimCountByTeam.get(team.id) ?? 0,
			latestUpdateAt: latestUpdateAtByTeam.get(team.id) ?? null,
			latestScrimAt: latestScrimAtByTeam.get(team.id) ?? null,
			canOpenWorkspace,
			summaryState: canOpenWorkspace ? summaryState : "unavailable",
		};
	};

	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
		avatarUrl: org.avatarUrl,
		bannerUrl: org.bannerUrl ?? null,
		description: org.description ?? null,
		website: org.website ?? null,
		discord: org.discord ?? null,
		twitter: org.twitter ?? null,
		isPublic: org.isPublic,
		lifecycleStatus: org.lifecycleStatus as
			| "active"
			| "archived"
			| "deletion_pending"
			| "irreversible",
		lifecycleWorkflow: lifecycleWorkflow ? mapLifecycleWorkflow(lifecycleWorkflow) : null,
		ownerId: org.ownerId,
		currentUser: {
			role: permissions.role,
			canManage: permissions.canManage,
			canManageBrand: permissions.canManageBrand,
			canDelete: permissions.canDelete,
			canTransferOwnership: permissions.canTransferOwnership,
			canLeave: permissions.canLeave,
			canManageMembers: permissions.canManageMembers,
			canManageTeams: permissions.canManageTeams,
			canManageInvites: permissions.canManageInvites,
			canManageSettings: permissions.canManageSettings,
		},
		activeTeams: org.teams
			.filter((team) => !team.isArchived)
			.map((team) => toOrgTeamSummary(org, team, oversightForTeam(team))),
		archivedTeams: org.teams
			.filter((team) => team.isArchived)
			.map((team) => toOrgTeamSummary(org, team, oversightForTeam(team))),
		members,
		pendingInvites,
		ownedListings,
		conversations: conversations.filter((conversation) => conversation.organizationId === orgId),
		ownershipWorkflow: ownershipWorkflow
			? mapOwnershipWorkflow(
					ownershipWorkflow,
					permissions.canTransferOwnership ? "authorized" : "limited"
				)
			: null,
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
					isPublic: true,
				},
				with: {
					teams: {
						where: eq(teamTable.isArchived, false),
						columns: { id: true, name: true, tag: true },
						with: {
							roster: {
								where: eq(teamRosterTable.userId, user.id),
								columns: { permissionRole: true, status: true },
							},
						},
					},
					recruitmentListings: {
						where: eq(recruitmentListingTable.status, "open"),
						columns: { id: true },
					},
				},
			},
		},
		orderBy: [asc(organizationMemberTable.createdAt)],
	});

	return c.json({
		data: memberships.map((membership) => {
			const orgCanManage = membership.role === "owner" || membership.role === "admin";
			const teams = membership.organization.teams
				.map((team) => {
					const roster = team.roster[0] ?? null;
					const hasViewableRosterStatus = roster?.status
						? TEAM_VIEWABLE_STATUSES.includes(
								roster.status as (typeof TEAM_VIEWABLE_STATUSES)[number]
							)
						: false;
					const canManage =
						orgCanManage || (hasViewableRosterStatus && roster?.permissionRole === "admin");
					const canViewWorkspace = canManage || hasViewableRosterStatus;

					return {
						id: team.id,
						name: team.name,
						tag: team.tag,
						canManage,
						canViewWorkspace,
						canViewRoster: canViewWorkspace,
						canViewSchedule: canManage || roster?.status === "active",
						canViewScrims: canViewWorkspace,
						canViewRecruiting: canViewWorkspace,
						canViewChat: canViewWorkspace,
						canViewUpdates: canViewWorkspace,
						canManageSettings: canManage,
						canLeave: roster !== null && roster.status !== "inactive",
					};
				})
				.filter((team) => team.canViewWorkspace);

			return {
				id: membership.organization.id,
				name: membership.organization.name,
				slug: membership.organization.slug,
				avatarUrl: membership.organization.avatarUrl,
				description: membership.organization.description ?? null,
				isPublic: membership.organization.isPublic,
				role: membership.role,
				teamCount: teams.length,
				openListingCount: membership.organization.recruitmentListings.length,
				canManage: orgCanManage,
				teams,
			};
		}),
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

	const slug = parsed.output.slug || nameToSlug(parsed.output.name);
	const fieldErrors = await getOrgIdentityFieldErrors({ name: parsed.output.name, slug });
	if (Object.keys(fieldErrors).length > 0) {
		return c.json({ error: "Organization identity is unavailable.", fieldErrors }, 409);
	}

	try {
		const org = await db.transaction(async (tx) => {
			const [createdOrg] = await tx
				.insert(organizationTable)
				.values({
					name: parsed.output.name,
					slug,
					description: parsed.output.description || null,
					avatarUrl: parsed.output.avatarUrl || null,
					bannerUrl: parsed.output.bannerUrl || null,
					website: parsed.output.website || null,
					discord: parsed.output.discord || null,
					twitter: parsed.output.twitter || null,
					isPublic: parsed.output.isPublic ?? true,
					ownerId: user.id,
				})
				.returning({ id: organizationTable.id });

			await tx.insert(organizationMemberTable).values({
				organizationId: createdOrg.id,
				userId: user.id,
				role: "owner",
				memberType: "staff",
				staffRole: "manager",
			});

			return createdOrg;
		});

		return c.json({ success: true, orgId: org.id });
	} catch (error) {
		const conflictResponse = getOrgIdentityConflictResponse(error);
		if (conflictResponse) return c.json(conflictResponse, 409);
		throw error;
	}
});

orgRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const detail = await getOrgWorkspaceDetail(orgId, user.id);
	if (!detail) {
		const org = await db.query.organizationTable.findFirst({
			where: eq(organizationTable.id, orgId),
			columns: { id: true, lifecycleStatus: true },
		});
		if (!org) return c.json({ error: "Organisation not found." }, 404);
		const reason =
			org.lifecycleStatus === "archived" || org.lifecycleStatus === "deletion_pending"
				? "lifecycle"
				: "role";
		logger.warn(
			{ userId: user.id, orgId, action: "view-org-workspace", reason },
			"permission denied"
		);
		return c.json({ error: "You do not have access to this organisation workspace.", reason }, 403);
	}
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
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	const slug = parsed.output.slug || nameToSlug(parsed.output.name);
	const fieldErrors = await getOrgIdentityFieldErrors({
		name: parsed.output.name,
		slug,
		ignoreOrgId: orgId,
	});
	if (Object.keys(fieldErrors).length > 0) {
		return c.json({ error: "Organization identity is unavailable.", fieldErrors }, 409);
	}

	try {
		await db
			.update(organizationTable)
			.set({
				name: parsed.output.name,
				slug,
				description: parsed.output.description || null,
				avatarUrl: parsed.output.avatarUrl || null,
				bannerUrl: parsed.output.bannerUrl || null,
				website: parsed.output.website || null,
				discord: parsed.output.discord || null,
				twitter: parsed.output.twitter || null,
				...(parsed.output.isPublic === undefined ? {} : { isPublic: parsed.output.isPublic }),
			})
			.where(eq(organizationTable.id, orgId));
	} catch (error) {
		const conflictResponse = getOrgIdentityConflictResponse(error);
		if (conflictResponse) return c.json(conflictResponse, 409);
		throw error;
	}

	return c.json({ success: true });
});

orgRoutes.post("/:id/ownership", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	// P21: validate the schema first so permission checks are performed on typed, sanitised data.
	let recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : undefined;
	if (!recipientUserId && typeof body.memberId === "string") {
		const target = await db.query.organizationMemberTable.findFirst({
			where: eq(organizationMemberTable.id, body.memberId),
			columns: { id: true, organizationId: true, userId: true },
		});
		if (!target || target.organizationId !== orgId) {
			return c.json({ error: "Target member not found." }, 404);
		}
		recipientUserId = target.userId;
	}
	const recoveryTargetUserId =
		typeof body.recoveryTargetUserId === "string" ? body.recoveryTargetUserId : user.id;

	const parsed = v.safeParse(InitiateOwnershipWorkflowSchema, {
		...body,
		entityType: "organization",
		entityId: orgId,
		kind: body.kind ?? "transfer",
		recipientUserId,
		recoveryTargetUserId,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.membership) {
		return c.json({ error: "You do not have organization access." }, 403);
	}
	if (parsed.output.kind === "transfer" && !permissions.canTransferOwnership) {
		return c.json({ error: "Only the org owner can start ownership transfer." }, 403);
	}
	if (parsed.output.kind === "recovery" && !permissions.canManage) {
		return c.json({ error: "Only organization managers can start ownership recovery." }, 403);
	}
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	const current = await getCurrentOwnershipWorkflow("organization", orgId);
	if (current) {
		return c.json(
			{ error: "An ownership workflow is already pending for this organization." },
			409
		);
	}

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { ownerId: true },
	});
	if (!org) return c.json({ error: "Organization not found." }, 404);

	const targetUserId =
		parsed.output.kind === "transfer"
			? parsed.output.recipientUserId
			: parsed.output.recoveryTargetUserId;
	const target = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, targetUserId ?? "")
		),
		columns: { id: true, organizationId: true, userId: true },
	});
	if (!target) return c.json({ error: "Ownership target must be an organization member." }, 400);

	const [workflow] = await db
		.insert(ownershipWorkflowTable)
		.values({
			entityType: "organization",
			entityId: orgId,
			kind: parsed.output.kind,
			status: parsed.output.kind === "recovery" ? "review_required" : "pending",
			requesterUserId: user.id,
			currentOwnerUserId: org.ownerId,
			recipientUserId: parsed.output.kind === "transfer" ? target.userId : null,
			recoveryTargetUserId: parsed.output.kind === "recovery" ? target.userId : null,
			verificationState: parsed.output.kind === "transfer" ? "required" : "not_required",
			reviewState: parsed.output.kind === "recovery" ? "required" : "not_required",
			reason: parsed.output.reason || null,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			metadata: { priorOwnerUserId: org.ownerId },
		})
		.returning({ id: ownershipWorkflowTable.id });

	await db.insert(ownershipWorkflowEventTable).values({
		workflowId: workflow.id,
		actorUserId: user.id,
		action: "created",
		fromStatus: null,
		toStatus: parsed.output.kind === "recovery" ? "review_required" : "pending",
		reason: parsed.output.reason || null,
		metadata: { previousOwnerUserId: org.ownerId },
	});

	if (parsed.output.kind === "transfer") {
		await createNotification({
			userId: target.userId,
			type: "generic",
			title: "Ownership transfer requested",
			body: "An organization owner has asked you to accept ownership.",
			referenceType: "ownership_workflow",
			referenceId: workflow.id,
			conflictBehavior: "always-insert",
		});
	} else if (org.ownerId && org.ownerId !== user.id) {
		await createNotification({
			userId: org.ownerId,
			type: "generic",
			title: "Ownership recovery started",
			body: "An organization ownership recovery workflow needs review.",
			referenceType: "ownership_workflow",
			referenceId: workflow.id,
			conflictBehavior: "always-insert",
		});
	}

	writeDomainAuditEvent({
		actorId: user.id,
		actorType: "user",
		domain: "ownership",
		actionType:
			parsed.output.kind === "transfer"
				? "ownership_transfer_initiated"
				: "ownership_recovery_initiated",
		targetType: "organization",
		targetId: orgId,
		outcome: "success",
		reason: parsed.output.reason ?? null,
		metadata: { workflowId: workflow.id, kind: parsed.output.kind },
	});
	return c.json({
		success: true,
		workflowId: workflow.id,
		status: parsed.output.kind === "recovery" ? "review_required" : "pending",
	});
});

orgRoutes.post("/:id/ownership/:workflowId/respond", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const workflowId = c.req.param("workflowId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToOwnershipWorkflowSchema, { ...body, workflowId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	await persistExpiredOwnershipWorkflows("organization", orgId);
	const workflow = await db.query.ownershipWorkflowTable.findFirst({
		where: and(
			eq(ownershipWorkflowTable.id, workflowId),
			eq(ownershipWorkflowTable.entityType, "organization"),
			eq(ownershipWorkflowTable.entityId, orgId)
		),
		columns: {
			id: true,
			kind: true,
			status: true,
			requesterUserId: true,
			currentOwnerUserId: true,
			recipientUserId: true,
			expiresAt: true,
		},
	});
	if (!workflow) return c.json({ error: "Ownership workflow not found." }, 404);
	if (workflow.kind !== "transfer" || workflow.status !== "pending") {
		return c.json({ error: "This ownership workflow is no longer pending." }, 409);
	}
	if (workflow.expiresAt && workflow.expiresAt < new Date()) {
		await db
			.update(ownershipWorkflowTable)
			.set({ status: "expired", result: "expired", resolvedAt: new Date() })
			.where(eq(ownershipWorkflowTable.id, workflow.id));
		return c.json({ error: "This ownership transfer has expired." }, 409);
	}
	if (workflow.recipientUserId !== user.id) {
		return c.json({ error: "Only the recipient can respond to this transfer." }, 403);
	}
	if (!workflow.recipientUserId || !workflow.currentOwnerUserId) {
		return c.json({ error: "Ownership workflow is missing required participants." }, 409);
	}
	const recipientUserId = workflow.recipientUserId;
	const currentOwnerUserId = workflow.currentOwnerUserId;

	if (parsed.output.action === "reject") {
		await db.transaction(async (tx) => {
			await tx
				.update(ownershipWorkflowTable)
				.set({
					status: "rejected",
					result: "rejected",
					resolvedAt: new Date(),
					metadata: { resultReason: parsed.output.reason ?? null },
				})
				.where(
					and(
						eq(ownershipWorkflowTable.id, workflow.id),
						eq(ownershipWorkflowTable.status, "pending")
					)
				);
			await tx.insert(ownershipWorkflowEventTable).values({
				workflowId: workflow.id,
				actorUserId: user.id,
				action: "rejected",
				fromStatus: workflow.status,
				toStatus: "rejected",
				reason: parsed.output.reason ?? null,
				metadata: {
					previousOwnerUserId: currentOwnerUserId,
					newOwnerUserId: recipientUserId,
					resultReason: parsed.output.reason ?? null,
				},
			});
		});
		if (workflow.requesterUserId) {
			await createNotification({
				userId: workflow.requesterUserId,
				type: "generic",
				title: "Ownership transfer rejected",
				body: "The recipient rejected the organization ownership transfer.",
				referenceType: "ownership_workflow",
				referenceId: workflow.id,
				conflictBehavior: "always-insert",
			});
		}
		writeDomainAuditEvent({
			actorId: user.id,
			actorType: "user",
			domain: "ownership",
			actionType: "ownership_transfer_declined",
			targetType: "organization",
			targetId: orgId,
			outcome: "success",
			metadata: { workflowId },
		});
		return c.json({ success: true, status: "rejected" });
	}

	await db.transaction(async (tx) => {
		await tx
			.update(organizationMemberTable)
			.set({ role: "admin" })
			.where(
				and(
					eq(organizationMemberTable.organizationId, orgId),
					eq(organizationMemberTable.userId, currentOwnerUserId)
				)
			);

		await tx
			.update(organizationMemberTable)
			.set({ role: "owner", memberType: "staff", staffRole: "manager" })
			.where(
				and(
					eq(organizationMemberTable.organizationId, orgId),
					eq(organizationMemberTable.userId, recipientUserId)
				)
			);

		await tx
			.update(organizationTable)
			.set({ ownerId: recipientUserId })
			.where(eq(organizationTable.id, orgId));

		await tx
			.update(ownershipWorkflowTable)
			.set({
				status: "accepted",
				verificationState: "verified",
				result: "transferred",
				resolvedAt: new Date(),
			})
			.where(
				and(
					eq(ownershipWorkflowTable.id, workflow.id),
					eq(ownershipWorkflowTable.status, "pending")
				)
			);

		await tx.insert(ownershipWorkflowEventTable).values({
			workflowId: workflow.id,
			actorUserId: user.id,
			action: "accepted",
			fromStatus: workflow.status,
			toStatus: "accepted",
			metadata: {
				previousOwnerUserId: currentOwnerUserId,
				newOwnerUserId: recipientUserId,
			},
		});
	});

	// P20: notify both parties on accept — the old owner that transfer went through,
	// and the new owner (recipient) confirming they now hold authority.
	if (currentOwnerUserId !== recipientUserId) {
		await createNotification({
			userId: currentOwnerUserId,
			type: "generic",
			title: "Ownership transfer accepted",
			body: "Organization ownership has transferred to the recipient.",
			referenceType: "ownership_workflow",
			referenceId: workflow.id,
			conflictBehavior: "always-insert",
		});
	}
	await createNotification({
		userId: recipientUserId,
		type: "generic",
		title: "You are now the organization owner",
		body: "You accepted the ownership transfer. You now hold full organization authority.",
		referenceType: "ownership_workflow",
		referenceId: workflow.id,
		conflictBehavior: "always-insert",
	});

	writeDomainAuditEvent({
		actorId: user.id,
		actorType: "user",
		domain: "ownership",
		actionType: "ownership_transfer_accepted",
		targetType: "organization",
		targetId: orgId,
		outcome: "success",
		metadata: { workflowId },
	});
	return c.json({ success: true, status: "accepted" });
});

orgRoutes.post("/:id/ownership/:workflowId/cancel", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const workflowId = c.req.param("workflowId");
	const body = await c.req.json().catch(() => ({}));
	const parsed = v.safeParse(CancelOwnershipWorkflowSchema, { ...body, workflowId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canTransferOwnership) {
		return c.json({ error: "Only the org owner can cancel ownership workflows." }, 403);
	}

	const workflow = await db.query.ownershipWorkflowTable.findFirst({
		where: and(
			eq(ownershipWorkflowTable.id, workflowId),
			eq(ownershipWorkflowTable.entityType, "organization"),
			eq(ownershipWorkflowTable.entityId, orgId)
		),
		columns: { id: true, status: true },
	});
	if (!workflow) return c.json({ error: "Ownership workflow not found." }, 404);
	if (
		workflow.status !== "pending" &&
		workflow.status !== "review_required" &&
		workflow.status !== "blocked"
	) {
		return c.json({ error: "Only open ownership workflows can be cancelled." }, 409);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(ownershipWorkflowTable)
			.set({
				status: "cancelled",
				result: "cancelled",
				resolvedAt: new Date(),
				metadata: { resultReason: parsed.output.reason ?? null },
			})
			.where(
				and(
					eq(ownershipWorkflowTable.id, workflowId),
					eq(ownershipWorkflowTable.status, workflow.status)
				)
			);
		await tx.insert(ownershipWorkflowEventTable).values({
			workflowId,
			actorUserId: user.id,
			action: "cancelled",
			fromStatus: workflow.status,
			toStatus: "cancelled",
			reason: parsed.output.reason ?? null,
			metadata: { resultReason: parsed.output.reason ?? null },
		});
	});

	return c.json({ success: true, status: "cancelled" });
});

orgRoutes.post("/:id/ownership/:workflowId/resolve", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const workflowId = c.req.param("workflowId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);
	const parsed = v.safeParse(ResolveOwnershipWorkflowSchema, { ...body, workflowId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const permissions = await getOrgPermissions(orgId, user.id);
	if (!permissions.canManageSettings) {
		return c.json({ error: "Recovery resolution requires organization manager authority." }, 403);
	}

	await persistExpiredOwnershipWorkflows("organization", orgId);
	const workflow = await db.query.ownershipWorkflowTable.findFirst({
		where: and(
			eq(ownershipWorkflowTable.id, workflowId),
			eq(ownershipWorkflowTable.entityType, "organization"),
			eq(ownershipWorkflowTable.entityId, orgId)
		),
		columns: {
			id: true,
			kind: true,
			status: true,
			currentOwnerUserId: true,
			recoveryTargetUserId: true,
		},
	});
	if (!workflow) return c.json({ error: "Ownership workflow not found." }, 404);
	if (workflow.kind !== "recovery" || workflow.status !== "review_required") {
		return c.json({ error: "Only recovery workflows in review can be resolved." }, 409);
	}

	const resolution = getOwnershipResolution(parsed.output.result);
	const recoveryTargetUserId = workflow.recoveryTargetUserId;
	if (parsed.output.result === "approve" && !recoveryTargetUserId) {
		return c.json({ error: "Recovery workflow is missing a recovery target." }, 409);
	}

	await db.transaction(async (tx) => {
		if (parsed.output.result === "approve" && recoveryTargetUserId) {
			await tx
				.update(organizationMemberTable)
				.set({ role: "admin" })
				.where(
					and(
						eq(organizationMemberTable.organizationId, orgId),
						eq(organizationMemberTable.role, "owner")
					)
				);

			const [promoted] = await tx
				.update(organizationMemberTable)
				.set({ role: "owner", memberType: "staff", staffRole: "manager" })
				.where(
					and(
						eq(organizationMemberTable.organizationId, orgId),
						eq(organizationMemberTable.userId, recoveryTargetUserId)
					)
				)
				.returning({ id: organizationMemberTable.id });
			if (!promoted) throw new Error("Recovery target is no longer an organization member.");

			await tx
				.update(organizationTable)
				.set({ ownerId: recoveryTargetUserId })
				.where(eq(organizationTable.id, orgId));
		}

		await tx
			.update(ownershipWorkflowTable)
			.set({
				status: resolution.status,
				reviewState: resolution.reviewState,
				result: resolution.workflowResult,
				resolvedAt: new Date(),
				metadata: { resultReason: parsed.output.reason ?? null },
			})
			.where(
				and(
					eq(ownershipWorkflowTable.id, workflowId),
					eq(ownershipWorkflowTable.status, workflow.status)
				)
			);

		await tx.insert(ownershipWorkflowEventTable).values({
			workflowId,
			actorUserId: user.id,
			action: resolution.workflowResult,
			fromStatus: workflow.status,
			toStatus: resolution.status,
			reason: parsed.output.reason ?? null,
			metadata: {
				previousOwnerUserId: workflow.currentOwnerUserId,
				newOwnerUserId: recoveryTargetUserId,
				resultReason: parsed.output.reason ?? null,
			},
		});
	});

	if (recoveryTargetUserId) {
		await createNotification({
			userId: recoveryTargetUserId,
			type: "generic",
			title: "Ownership recovery resolved",
			body:
				parsed.output.result === "approve"
					? "Organization ownership recovery was approved."
					: "Organization ownership recovery was not approved.",
			referenceType: "ownership_workflow",
			referenceId: workflowId,
			conflictBehavior: "always-insert",
		});
	}

	return c.json({ success: true });
});

orgRoutes.post("/:id/archive", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const parsed = v.safeParse(LifecycleArchiveSchema, {
		...body,
		entityType: "organization",
		entityId: orgId,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can archive it." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { id: true, lifecycleStatus: true, isPublic: true },
	});
	if (!org) return c.json({ error: "Organisation not found." }, 404);
	if (org.lifecycleStatus === "irreversible") {
		return c.json({ error: "This organization has reached an irreversible lifecycle state." }, 409);
	}

	// P15/P16: gather active team IDs to propagate the archive and close channels.
	const activeTeams = await db.query.teamTable.findMany({
		where: and(eq(teamTable.organizationId, orgId), ne(teamTable.isArchived, true)),
		columns: { id: true },
	});
	const activeTeamIds = activeTeams.map((t) => t.id);

	await db.transaction(async (tx) => {
		await tx
			.update(organizationTable)
			.set({ lifecycleStatus: "archived", lifecycleUpdatedAt: new Date(), isPublic: false })
			.where(eq(organizationTable.id, orgId));
		// P15: propagate archive to non-archived child teams.
		await tx
			.update(teamTable)
			.set({
				isArchived: true,
				isRecruiting: false,
				lifecycleStatus: "archived",
				lifecycleUpdatedAt: new Date(),
			})
			.where(and(eq(teamTable.organizationId, orgId), ne(teamTable.isArchived, true)));
		// P16: close chat channels for all previously-active teams.
		if (activeTeamIds.length > 0) {
			await tx
				.update(chatChannelTable)
				.set({ isArchived: true })
				.where(inArray(chatChannelTable.teamId, activeTeamIds));
		}
		await tx.insert(lifecycleWorkflowTable).values({
			entityType: "organization",
			entityId: orgId,
			action: "archive",
			status: "archived",
			actorUserId: user.id,
			reason: parsed.output.reason ?? null,
			metadata: {
				priorLifecycleStatus: org.lifecycleStatus,
				priorIsPublic: org.isPublic,
			},
		});
	});

	return c.json({ success: true, lifecycleStatus: "archived" });
});

orgRoutes.post("/:id/restore", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const parsed = v.safeParse(LifecycleRestoreSchema, {
		...body,
		entityType: "organization",
		entityId: orgId,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can restore it." }, 403);

	const workflow = await getCurrentLifecycleWorkflow("organization", orgId);
	if (workflow?.status === "deletion_pending") {
		return c.json({ error: "Cancel the deletion-pending workflow before restoring." }, 409);
	}

	const updated = await db
		.update(organizationTable)
		.set({ lifecycleStatus: "active", lifecycleUpdatedAt: new Date() })
		.where(
			and(eq(organizationTable.id, orgId), ne(organizationTable.lifecycleStatus, "irreversible"))
		)
		.returning({ id: organizationTable.id });
	if (updated.length === 0) {
		return c.json({ error: "Organization not found or irreversible." }, 404);
	}

	if (workflow?.status === "archived") {
		await db
			.update(lifecycleWorkflowTable)
			.set({
				status: "settled",
				workflowState: "settled",
				result: "restored",
				settledAt: new Date(),
			})
			.where(eq(lifecycleWorkflowTable.id, workflow.id));
	}

	return c.json({ success: true, lifecycleStatus: "active" });
});

orgRoutes.post("/:id/deletion/request-code", async (c) => {
	const session = c.get("session");
	const user = c.get("user");
	const orgId = c.req.param("id");
	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can request deletion." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { id: true, name: true, lifecycleStatus: true },
	});
	if (!org) return c.json({ error: "Organisation not found." }, 404);
	const blockReason = getLifecycleMutationBlockReason("Organization", org.lifecycleStatus);
	if (blockReason && org.lifecycleStatus !== "archived") return c.json({ error: blockReason }, 409);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`org-lifecycle-delete-request:${session.userId}:${orgId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"organization_lifecycle_delete",
		{ orgId, orgName: org.name },
		client.ip
	);
	await sendMail({
		to: user.email,
		subject: "Confirm organization deletion request",
		template: createElement(VerificationEmail, {
			code,
			title: "Confirm organization deletion request",
			message: `You requested deletion-pending for ${org.name}. Enter this code to continue.`,
			actionText: "enter the following confirmation code",
		}),
	});

	return c.json({ success: true });
});

orgRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const session = c.get("session");
	const orgId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteOrgSchema, { ...body, orgId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can delete it." }, 403);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { id: true, name: true, lifecycleStatus: true, isPublic: true },
		with: {
			teams: { columns: { id: true, isArchived: true } },
		},
	});
	if (!org) return c.json({ error: "Organisation not found." }, 404);
	if (org.name !== parsed.output.confirmName) {
		return c.json({ error: "Organisation name does not match." }, 400);
	}
	if (!parsed.output.verificationCode) {
		return c.json({ error: "Verification code is required for deletion-pending requests." }, 400);
	}
	const { allowed, retryAfterMs } = await checkRateLimit(
		`org-lifecycle-delete-verify:${session.userId}:${orgId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}
	const verification = await validateAndConsumeSensitiveAction(
		session.userId,
		"organization_lifecycle_delete",
		parsed.output.verificationCode
	);
	if (!verification.success) return c.json({ error: "Invalid or expired verification code." }, 400);
	if (verification.metadata?.orgId !== orgId) {
		await deleteSensitiveActionVerification(session.userId, "organization_lifecycle_delete");
		return c.json({ error: "Verification code does not match this organization." }, 400);
	}
	if (org.lifecycleStatus === "irreversible") {
		return c.json({ error: "This organization has already reached irreversible settlement." }, 409);
	}
	const activeTeams = org.teams.filter((team) => !team.isArchived);
	if (activeTeams.length > 0 && parsed.output.retentionPolicy !== "archive_all_teams") {
		return c.json(
			{
				error:
					"Archive or transfer active teams before requesting organization deletion, or choose the archive-all retention policy.",
			},
			409
		);
	}

	// P34: Pre-flight AC7 checks — block if outstanding records would be orphaned.
	const teamIds = org.teams.map((t) => t.id);
	if (teamIds.length > 0) {
		// Block on disputed scrims for any child team.
		const disputedScrims = await db
			.select({ id: scrimTable.id })
			.from(scrimTable)
			.where(
				and(
					eq(scrimTable.status, "disputed"),
					or(inArray(scrimTable.homeTeamId, teamIds), inArray(scrimTable.awayTeamId, teamIds))
				)
			)
			.limit(1);
		if (disputedScrims.length > 0) {
			return c.json(
				{ error: "Resolve all disputed scrims before requesting organization deletion." },
				409
			);
		}

		// Block on pending recruiting applications for any child team listing.
		const pendingApplications = await db
			.select({ id: recruitmentApplicationTable.id })
			.from(recruitmentApplicationTable)
			.innerJoin(
				recruitmentListingTable,
				eq(recruitmentApplicationTable.listingId, recruitmentListingTable.id)
			)
			.where(
				and(
					inArray(recruitmentListingTable.teamId, teamIds),
					eq(recruitmentApplicationTable.status, "pending")
				)
			)
			.limit(1);
		if (pendingApplications.length > 0) {
			return c.json(
				{
					error:
						"Close or withdraw all pending recruiting applications before requesting organization deletion.",
				},
				409
			);
		}

		// Block on open ownership workflows for any child team.
		const openTeamOwnershipWorkflows = await db
			.select({ id: ownershipWorkflowTable.id })
			.from(ownershipWorkflowTable)
			.where(
				and(
					eq(ownershipWorkflowTable.entityType, "team"),
					inArray(ownershipWorkflowTable.entityId, teamIds),
					eq(ownershipWorkflowTable.status, "pending")
				)
			)
			.limit(1);
		if (openTeamOwnershipWorkflows.length > 0) {
			return c.json(
				{
					error:
						"Settle all open ownership workflows on child teams before requesting organization deletion.",
				},
				409
			);
		}
	}

	const recoveryUntil = getLifecycleRecoveryUntil();
	await db.transaction(async (tx) => {
		await tx
			.update(organizationTable)
			.set({
				lifecycleStatus: "deletion_pending",
				lifecycleUpdatedAt: new Date(),
				isPublic: false,
			})
			.where(eq(organizationTable.id, orgId));
		await tx
			.update(teamTable)
			.set({
				isArchived: true,
				isRecruiting: false,
				lifecycleStatus: "archived",
				lifecycleUpdatedAt: new Date(),
			})
			.where(eq(teamTable.organizationId, orgId));
		if (org.teams.length > 0) {
			await tx
				.update(chatChannelTable)
				.set({ isArchived: true })
				.where(
					inArray(
						chatChannelTable.teamId,
						org.teams.map((team) => team.id)
					)
				);
		}
		await tx.insert(lifecycleWorkflowTable).values({
			entityType: "organization",
			entityId: orgId,
			action: "deletion_request",
			status: "deletion_pending",
			actorUserId: user.id,
			reason: parsed.output.reason ?? null,
			recoveryUntil,
			metadata: {
				confirmName: parsed.output.confirmName,
				priorLifecycleStatus: org.lifecycleStatus,
				priorIsPublic: org.isPublic,
				retentionPolicy: parsed.output.retentionPolicy ?? "preserve_history",
			},
		});
	});
	await deleteSensitiveActionVerification(session.userId, "organization_lifecycle_delete");

	return c.json({
		success: true,
		lifecycleStatus: "deletion_pending",
		recoveryUntil: recoveryUntil.toISOString(),
	});
});

orgRoutes.post("/:id/deletion/cancel", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");
	const parsed = v.safeParse(LifecycleDeletionCancelSchema, {
		...(await c.req.json().catch(() => ({}))),
		entityType: "organization",
		entityId: orgId,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can cancel deletion." }, 403);

	const workflow = await getCurrentLifecycleWorkflow("organization", orgId);
	if (!workflow || workflow.status !== "deletion_pending") {
		return c.json({ error: "No pending organization deletion was found." }, 404);
	}
	if (workflow.recoveryUntil && workflow.recoveryUntil <= new Date()) {
		return c.json({ error: "The recovery window has expired." }, 409);
	}

	// P2: restore to the lifecycle state that preceded deletion-pending, not always "active".
	// The prior status is stored in workflow metadata when the deletion workflow was created.
	const priorLifecycleStatus =
		(workflow.metadata as { priorLifecycleStatus?: string } | null)?.priorLifecycleStatus ??
		"active";

	await db.transaction(async (tx) => {
		await tx
			.update(organizationTable)
			.set({ lifecycleStatus: priorLifecycleStatus, lifecycleUpdatedAt: new Date() })
			.where(eq(organizationTable.id, orgId));
		await tx
			.update(lifecycleWorkflowTable)
			.set({
				status: "settled",
				workflowState: "settled",
				result: "cancelled",
				settledAt: new Date(),
				reason: parsed.output.reason ?? workflow.reason,
			})
			.where(eq(lifecycleWorkflowTable.id, workflow.id));
	});

	return c.json({ success: true, lifecycleStatus: priorLifecycleStatus });
});

orgRoutes.post("/:id/deletion/settle", async (c) => {
	const user = c.get("user");
	const orgId = c.req.param("id");

	// P9/P18: validate body so the reason field is typed and trimmed.
	const parsed = v.safeParse(LifecycleSettlementSchema, {
		...(await c.req.json().catch(() => ({}))),
		entityType: "organization",
		entityId: orgId,
		action: "irreversible_settlement",
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return c.json({ error: "Only the org owner can settle deletion." }, 403);

	const workflow = await getCurrentLifecycleWorkflow("organization", orgId);
	if (!workflow || workflow.status !== "deletion_pending") {
		return c.json({ error: "No pending organization deletion was found." }, 404);
	}
	if (workflow.recoveryUntil && workflow.recoveryUntil > new Date()) {
		return c.json({ error: "The recovery window has not expired." }, 409);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(organizationTable)
			.set({ lifecycleStatus: "irreversible", lifecycleUpdatedAt: new Date(), isPublic: false })
			.where(eq(organizationTable.id, orgId));
		await tx
			.update(lifecycleWorkflowTable)
			.set({ status: "irreversible", result: "settled", settledAt: new Date() })
			.where(eq(lifecycleWorkflowTable.id, workflow.id));
	});

	return c.json({ success: true, lifecycleStatus: "irreversible" });
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
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	// TODO(story-2.5-audit): attach org-scoped activity log with actor, target, previous role,
	// new role, timestamp, and scope once non-security audit events are modeled.
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
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	const orgTeams = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.userId, member.userId),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true, teamId: true },
	});
	const affectedTeamIds = [
		...new Set(
			orgTeams.filter((row) => row.team.organizationId === orgId).map((row) => row.teamId)
		),
	];

	await db.transaction(async (tx) => {
		for (const rosterEntry of orgTeams.filter((row) => row.team.organizationId === orgId)) {
			// TODO(story-2.5-audit): attach affected-team timeline event with actor, target,
			// scope, and removal reason once org/team activity records exist.
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterEntry.id));
		}

		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, member.id));
	});

	return c.json({ success: true, affectedTeamIds });
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
	if (!permissions.canManageInvites) return c.json({ data: [] });

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
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

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

	// TODO(story-2.5-audit): attach org invite activity with actor, target, role/scope,
	// and expiry timestamp once org operational activity records exist.
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
	if (!permissions.canManageInvites)
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
	if (!permissions.canManageInvites)
		return c.json({ error: "You do not have permission to resend invites." }, 403);
	const lifecycleBlock = await getOrgLifecycleBlock(orgId);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

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

export { orgRoutes };
