import { and, desc, eq, gte, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import {
	chatChannelMemberTable,
	chatChannelTable,
	chatMessageTable,
	organizationMemberTable,
	recruitmentListingTable,
	teamRosterTable,
} from "@/db/schema";
import { getOrgPermissions } from "@/utils/org";
import { getTeamAccessContext } from "@/utils/team";

const EMPTY_ROLE_LIST: Array<"tank" | "damage" | "support"> = [];

function toRoleList(value: unknown): Array<"tank" | "damage" | "support"> {
	if (!Array.isArray(value)) return EMPTY_ROLE_LIST;
	return value.filter(
		(role): role is "tank" | "damage" | "support" =>
			role === "tank" || role === "damage" || role === "support"
	);
}

export function normalizeMemberFields(input: {
	memberType?: "player" | "staff" | null;
	staffRole?: "coach" | "analyst" | "manager" | "staff" | null;
	gameRole?: "tank" | "damage" | "support" | null;
	roleInTeam?: "tank" | "damage" | "support" | null;
}) {
	const memberType = input.memberType ?? (input.staffRole ? "staff" : "player");
	const gameRole = input.gameRole ?? input.roleInTeam ?? null;

	return {
		memberType,
		staffRole: memberType === "staff" ? (input.staffRole ?? "staff") : null,
		gameRole: memberType === "player" ? gameRole : null,
		roleInTeam: memberType === "player" ? gameRole : null,
	};
}

export async function canManageRecruitmentListing(
	listing: {
		userId: string;
		ownerType: "player" | "team" | "organization";
		teamId: string | null;
		organizationId: string | null;
	},
	userId: string
) {
	if (listing.ownerType === "player") return listing.userId === userId;
	if (listing.ownerType === "team" && listing.teamId) {
		const access = await getTeamAccessContext(listing.teamId, userId);
		return access?.canManageTeam ?? false;
	}
	if (listing.ownerType === "organization" && listing.organizationId) {
		const permissions = await getOrgPermissions(listing.organizationId, userId);
		return permissions.canManage;
	}
	return false;
}

export async function ensureOrganizationMembership(
	tx: {
		query: typeof db.query;
		insert: typeof db.insert;
		update: typeof db.update;
	},
	params: {
		organizationId: string;
		userId: string;
		role?: "owner" | "admin" | "member";
		memberType?: "player" | "staff";
		staffRole?: "coach" | "analyst" | "manager" | "staff" | null;
		gameRole?: "tank" | "damage" | "support" | null;
	}
) {
	const existing = await tx.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, params.organizationId),
			eq(organizationMemberTable.userId, params.userId)
		),
		columns: { id: true, role: true },
	});

	const normalized = normalizeMemberFields({
		memberType: params.memberType ?? null,
		staffRole: params.staffRole ?? null,
		gameRole: params.gameRole ?? null,
	});

	if (existing) {
		await tx
			.update(organizationMemberTable)
			.set({
				role: params.role ?? existing.role,
				memberType: normalized.memberType,
				staffRole: normalized.staffRole,
				gameRole: normalized.gameRole,
			})
			.where(eq(organizationMemberTable.id, existing.id));
		return existing.id;
	}

	const [membership] = await tx
		.insert(organizationMemberTable)
		.values({
			organizationId: params.organizationId,
			userId: params.userId,
			role: params.role ?? "member",
			memberType: normalized.memberType,
			staffRole: normalized.staffRole,
			gameRole: normalized.gameRole,
		})
		.returning({ id: organizationMemberTable.id });

	return membership.id;
}

export async function ensureTeamMembership(
	tx: {
		query: typeof db.query;
		insert: typeof db.insert;
		update: typeof db.update;
	},
	params: {
		teamId: string;
		userId: string;
		permissionRole?: "admin" | "member";
		status?: "active" | "benched" | "trial" | "inactive";
		memberType?: "player" | "staff";
		staffRole?: "coach" | "analyst" | "manager" | "staff" | null;
		gameRole?: "tank" | "damage" | "support" | null;
	}
) {
	const existing = await tx.query.teamRosterTable.findFirst({
		where: and(
			eq(teamRosterTable.teamId, params.teamId),
			eq(teamRosterTable.userId, params.userId)
		),
		columns: { id: true },
	});

	const normalized = normalizeMemberFields({
		memberType: params.memberType ?? null,
		staffRole: params.staffRole ?? null,
		gameRole: params.gameRole ?? null,
	});

	const payload = {
		memberType: normalized.memberType,
		roleInTeam: normalized.roleInTeam,
		staffRole: normalized.staffRole,
		permissionRole: params.permissionRole ?? "member",
		status: params.status ?? "active",
		leftAt: params.status === "inactive" ? new Date() : null,
		joinedAt: new Date(),
	};

	if (existing) {
		await tx.update(teamRosterTable).set(payload).where(eq(teamRosterTable.id, existing.id));
		return existing.id;
	}

	const [member] = await tx
		.insert(teamRosterTable)
		.values({
			teamId: params.teamId,
			userId: params.userId,
			...payload,
		})
		.returning({ id: teamRosterTable.id });

	return member.id;
}

export function mapTeamMember(row: {
	id: string;
	userId: string;
	memberType: "player" | "staff";
	roleInTeam: "tank" | "damage" | "support" | null;
	staffRole: "coach" | "analyst" | "manager" | "staff" | null;
	permissionRole: "admin" | "member";
	status: "active" | "benched" | "trial" | "inactive";
	joinedAt: Date;
	leftAt: Date | null;
	updatedAt: Date;
	user: {
		id: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		profile?: {
			primaryRole: "tank" | "damage" | "support" | null;
			rank: string | null;
			rankDivision: number | null;
		} | null;
	};
}) {
	return {
		id: row.id,
		userId: row.user.id,
		username: row.user.username,
		displayName: row.user.displayName,
		avatarUrl: row.user.avatarUrl,
		memberType: row.memberType,
		staffRole: row.staffRole ?? null,
		gameRole: row.roleInTeam ?? null,
		roleInTeam: row.roleInTeam ?? null,
		primaryRole: row.user.profile?.primaryRole ?? null,
		rank: row.user.profile?.rank ?? null,
		rankDivision: row.user.profile?.rankDivision ?? null,
		permissionRole: row.permissionRole,
		status: row.status,
		joinedAt: row.joinedAt.toISOString(),
		leftAt: row.leftAt?.toISOString() ?? null,
		statusChangedAt: row.updatedAt.toISOString(),
	};
}

export function mapRecruitmentListing(
	row: {
		id: string;
		type: "lft" | "lfp" | "lfr" | "lfs";
		status: "open" | "closed" | "fulfilled" | "expired";
		ownerType: "player" | "team" | "organization";
		title: string;
		description: string | null;
		memberType: "player" | "staff";
		staffRole: "coach" | "analyst" | "manager" | "staff" | null;
		rolesNeeded: unknown;
		minRank: string | null;
		maxRank: string | null;
		minRating: number | null;
		maxRating: number | null;
		region: string | null;
		expiresAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		userId: string;
		organizationId: string | null;
		teamId: string | null;
		user: { id: string; username: string; displayName: string; avatarUrl: string | null };
		organization?: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
		team?: {
			id: string;
			name: string;
			tag: string;
			avatarUrl: string | null;
			rating: number;
		} | null;
		applications?: Array<{
			id: string;
			status: "pending" | "accepted" | "rejected" | "withdrawn";
			applicantUserId: string;
		}>;
	},
	params?: {
		viewerId?: string | null;
		canManage?: boolean;
	}
) {
	const viewerId = params?.viewerId ?? null;
	const isExpiredByTime = row.expiresAt ? row.expiresAt.getTime() < Date.now() : false;
	const effectiveStatus = row.status === "open" && isExpiredByTime ? "expired" : row.status;
	const applicationCount =
		row.applications?.filter((application) => application.status !== "withdrawn").length ?? 0;
	const hasApplied = viewerId
		? (row.applications ?? []).some(
				(application) =>
					application.applicantUserId === viewerId && application.status === "pending"
			)
		: false;
	const gameRoles = toRoleList(row.rolesNeeded);
	const canManage = params?.canManage ?? false;

	return {
		id: row.id,
		category: row.type,
		type: row.type,
		status: effectiveStatus,
		ownerType: row.ownerType,
		title: row.title,
		description: row.description ?? null,
		memberType: row.memberType,
		staffRole: row.staffRole ?? null,
		gameRoles,
		rolesNeeded: gameRoles,
		minRank: row.minRank ?? null,
		maxRank: row.maxRank ?? null,
		minRating: row.minRating ?? null,
		maxRating: row.maxRating ?? null,
		region: row.region ?? null,
		expiresAt: row.expiresAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		ownerUserId: row.user.id,
		ownerUsername: row.user.username,
		userId: row.user.id,
		ownerDisplayName: row.user.displayName,
		userDisplayName: row.user.displayName,
		ownerAvatarUrl: row.user.avatarUrl,
		userAvatarUrl: row.user.avatarUrl,
		organizationId: row.organization?.id ?? row.organizationId ?? null,
		organizationName: row.organization?.name ?? null,
		organizationSlug: row.organization?.slug ?? null,
		organizationAvatarUrl: row.organization?.avatarUrl ?? null,
		teamId: row.team?.id ?? row.teamId ?? null,
		teamName: row.team?.name ?? null,
		teamTag: row.team?.tag ?? null,
		teamAvatarUrl: row.team?.avatarUrl ?? null,
		rating: row.team?.rating ?? null,
		applicationCount,
		hasApplied,
		canManage,
		canApply: !canManage && effectiveStatus === "open" && !hasApplied,
	};
}

export async function sweepExpiredListings() {
	const expiredListings = await db
		.update(recruitmentListingTable)
		.set({ status: "expired" })
		.where(
			and(
				eq(recruitmentListingTable.status, "open"),
				lt(recruitmentListingTable.expiresAt, new Date())
			)
		)
		.returning({ id: recruitmentListingTable.id });

	return expiredListings.length;
}

export function mapRecruitmentApplication(row: {
	id: string;
	listingId: string;
	message: string | null;
	status: "pending" | "accepted" | "rejected" | "withdrawn";
	createdAt: Date;
	updatedAt: Date;
	applicantUserId: string;
	applicantTeamId: string | null;
	applicantOrganizationId: string | null;
	applicant: {
		id: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		profile?: {
			primaryRole: "tank" | "damage" | "support" | null;
			rank: string | null;
		} | null;
	};
	applicantTeam?: { id: string; name: string; tag: string } | null;
	applicantOrganization?: { id: string; name: string; slug?: string } | null;
	listing?: { id: string; type: "lft" | "lfp" | "lfr" | "lfs"; title: string } | null;
	chatChannels?: Array<{ id: string }>;
}) {
	const senderType =
		row.applicantTeamId !== null
			? "team"
			: row.applicantOrganizationId !== null
				? "organization"
				: "player";

	return {
		id: row.id,
		listingId: row.listingId,
		conversationId: row.chatChannels?.[0]?.id ?? null,
		status: row.status,
		message: row.message ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		senderType,
		senderUserId: row.applicant.id,
		senderUsername: row.applicant.username,
		senderDisplayName: row.applicant.displayName,
		senderAvatarUrl: row.applicant.avatarUrl,
		senderOrganizationId: row.applicantOrganization?.id ?? row.applicantOrganizationId ?? null,
		senderOrganizationName: row.applicantOrganization?.name ?? null,
		senderOrganizationSlug: row.applicantOrganization?.slug ?? null,
		senderTeamId: row.applicantTeam?.id ?? row.applicantTeamId ?? null,
		senderTeamName: row.applicantTeam?.name ?? null,
		senderTeamTag: row.applicantTeam?.tag ?? null,
		teamName: row.applicantTeam?.name ?? null,
		teamTag: row.applicantTeam?.tag ?? null,
		senderMemberType: "player",
		senderStaffRole: null,
		senderGameRoles: row.applicant.profile?.primaryRole ? [row.applicant.profile.primaryRole] : [],
		senderPrimaryRole: row.applicant.profile?.primaryRole ?? null,
		senderRank: row.applicant.profile?.rank ?? null,
		applicantUserId: row.applicant.id,
		applicantDisplayName: row.applicant.displayName,
		applicantAvatarUrl: row.applicant.avatarUrl,
		applicantPrimaryRole: row.applicant.profile?.primaryRole ?? null,
		applicantRank: row.applicant.profile?.rank ?? null,
		listingCategory: row.listing?.type ?? "lfp",
		listingTitle: row.listing?.title ?? "Recruitment listing",
	};
}

export async function getRecruitmentConversationsForUser(userId: string) {
	const rows = await db.query.chatChannelMemberTable.findMany({
		where: and(eq(chatChannelMemberTable.userId, userId), isNull(chatChannelMemberTable.leftAt)),
		with: {
			channel: {
				with: {
					recruitmentApplication: {
						with: {
							listing: {
								with: {
									user: {
										columns: { id: true, username: true, displayName: true, avatarUrl: true },
									},
									organization: {
										columns: { id: true, name: true, slug: true, avatarUrl: true },
									},
									team: {
										columns: {
											id: true,
											name: true,
											tag: true,
											avatarUrl: true,
											rating: true,
										},
									},
								},
							},
							applicant: {
								columns: { id: true, username: true, displayName: true, avatarUrl: true },
								with: {
									profile: { columns: { primaryRole: true, rank: true } },
								},
							},
							applicantTeam: {
								columns: { id: true, name: true, tag: true },
							},
							applicantOrganization: {
								columns: { id: true, name: true, slug: true },
							},
						},
					},
					members: {
						where: isNull(chatChannelMemberTable.leftAt),
						with: {
							user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
						},
					},
					messages: {
						orderBy: [desc(chatMessageTable.createdAt)],
						limit: 1,
						with: {
							sender: { columns: { id: true, displayName: true, avatarUrl: true } },
						},
					},
				},
			},
		},
		orderBy: [desc(chatChannelMemberTable.createdAt)],
	});

	return rows
		.map((row) => {
			const channel = row.channel;
			if (!channel?.recruitmentApplication?.listing) return null;
			const listing = mapRecruitmentListing(channel.recruitmentApplication.listing, {
				viewerId: userId,
			});
			const application = mapRecruitmentApplication(channel.recruitmentApplication);
			const otherMember = channel.members.find((member) => member.user.id !== userId);
			const lastMessage = channel.messages[0];

			// If the current user is the applicant (sender), counterpart is the listing owner.
			// If the current user owns the listing, counterpart is the applicant.
			const currentUserIsSender = application.senderUserId === userId;
			const counterpartType = currentUserIsSender ? listing.ownerType : application.senderType;
			const counterpartUsername = currentUserIsSender
				? counterpartType === "player"
					? channel.recruitmentApplication.listing.user.username
					: null
				: counterpartType === "player"
					? channel.recruitmentApplication.applicant.username
					: null;
			const counterpartOrgSlug = currentUserIsSender
				? listing.organizationSlug
				: application.senderOrganizationSlug;

			return {
				conversationId: channel.id,
				applicationId: application.id,
				listingId: application.listingId,
				listingCategory: listing.category,
				listingTitle: listing.title,
				listingStatus: listing.status,
				counterpartLabel:
					otherMember?.user.displayName ??
					(currentUserIsSender ? listing.ownerDisplayName : application.senderDisplayName),
				counterpartAvatarUrl:
					otherMember?.user.avatarUrl ??
					(currentUserIsSender ? listing.ownerAvatarUrl : application.senderAvatarUrl),
				counterpartType,
				counterpartUsername,
				counterpartOrgSlug,
				organizationId: listing.organizationId,
				teamId: listing.teamId,
				lastMessagePreview: lastMessage?.content ?? application.message ?? null,
				lastMessageAt: lastMessage?.createdAt?.toISOString() ?? null,
				unreadCount: 0,
				isArchived: channel.isArchived,
			};
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function createRecruitmentConversation(params: {
	applicationId: string;
	listingOwnerUserId: string;
	senderUserId: string;
	listingTitle: string;
}) {
	const [channel] = await db
		.insert(chatChannelTable)
		.values({
			channelType: "recruitment",
			name: params.listingTitle,
			recruitmentApplicationId: params.applicationId,
		})
		.returning({ id: chatChannelTable.id });

	await db.insert(chatChannelMemberTable).values([
		{ channelId: channel.id, userId: params.listingOwnerUserId },
		{ channelId: channel.id, userId: params.senderUserId },
	]);

	return channel.id;
}

export async function sendRecruitmentSystemMessage(channelId: string, content: string) {
	const channel = await db.query.chatChannelTable.findFirst({
		where: eq(chatChannelTable.id, channelId),
		columns: { id: true },
	});
	if (!channel) return;

	const firstMember = await db.query.chatChannelMemberTable.findFirst({
		where: eq(chatChannelMemberTable.channelId, channelId),
		columns: { userId: true },
	});
	if (!firstMember) return;

	await db.insert(chatMessageTable).values({
		channelId,
		senderId: firstMember.userId,
		content,
		isSystemMessage: true,
	});
}

export async function getPublicRecruitmentListings(filters?: {
	category?: "lft" | "lfp" | "lfr" | "lfs";
	memberType?: "player" | "staff";
	region?: string;
}) {
	const now = new Date();
	const rows = await db.query.recruitmentListingTable.findMany({
		where: and(
			eq(recruitmentListingTable.status, "open"),
			or(isNull(recruitmentListingTable.expiresAt), gte(recruitmentListingTable.expiresAt, now)),
			filters?.category ? eq(recruitmentListingTable.type, filters.category) : undefined,
			filters?.memberType ? eq(recruitmentListingTable.memberType, filters.memberType) : undefined,
			filters?.region ? eq(recruitmentListingTable.region, filters.region) : undefined
		),
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
		limit: 100,
	});

	return rows.map((row) => mapRecruitmentListing(row));
}

export async function getPublicRecruitmentListingById(id: string) {
	const row = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, id),
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
	});

	if (!row) return null;
	return mapRecruitmentListing(row);
}
