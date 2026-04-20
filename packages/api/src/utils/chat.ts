import type { ChatConversationSummary } from "@scrimflow/shared";
import { and, count, desc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import {
	chatChannelMemberTable,
	chatChannelTable,
	chatMessageReadTable,
	chatMessageTable,
	scrimTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";

const TEAM_CHAT_MEMBER_STATUSES = ["active", "benched", "trial"] as const;

function normalizeMessageContent(content: string, deletedAt: Date | null): string {
	if (deletedAt) return "[deleted]";
	return content;
}

function buildTeamChannelName(team: { name: string; tag: string }) {
	return `[${team.tag}] ${team.name} Team Chat`;
}

function buildScrimChannelName(
	kind: "scrim_negotiation" | "scrim_lobby",
	teams: {
		homeTeam: { name: string; tag: string };
		awayTeam: { name: string; tag: string };
	}
) {
	const suffix = kind === "scrim_lobby" ? "Lobby" : "Negotiation";
	return `[${teams.homeTeam.tag}] ${teams.homeTeam.name} vs [${teams.awayTeam.tag}] ${teams.awayTeam.name} ${suffix}`;
}

async function listActiveRosterUserIds(teamId: string) {
	const members = await db.query.teamRosterTable.findMany({
		where: and(
			eq(teamRosterTable.teamId, teamId),
			inArray(teamRosterTable.status, TEAM_CHAT_MEMBER_STATUSES)
		),
		columns: { userId: true },
	});
	return [...new Set(members.map((member) => member.userId))];
}

async function listTeamAdminUserIds(teamId: string) {
	const members = await db.query.teamRosterTable.findMany({
		where: and(
			eq(teamRosterTable.teamId, teamId),
			inArray(teamRosterTable.status, TEAM_CHAT_MEMBER_STATUSES),
			eq(teamRosterTable.permissionRole, "admin")
		),
		columns: { userId: true },
	});
	return [...new Set(members.map((member) => member.userId))];
}

async function syncChannelMembers(params: {
	channelId: string;
	userIds: string[];
	mode: "append" | "sync";
}) {
	const nextUserIds = [...new Set(params.userIds)];
	const existingMembers = await db.query.chatChannelMemberTable.findMany({
		where: eq(chatChannelMemberTable.channelId, params.channelId),
		columns: { id: true, userId: true, leftAt: true },
	});

	const existingByUserId = new Map(existingMembers.map((member) => [member.userId, member]));
	const missingUserIds = nextUserIds.filter((userId) => !existingByUserId.has(userId));

	if (missingUserIds.length > 0) {
		await db
			.insert(chatChannelMemberTable)
			.values(
				missingUserIds.map((userId) => ({
					channelId: params.channelId,
					userId,
				}))
			)
			.onConflictDoNothing();
	}

	const rejoinIds = nextUserIds
		.map((userId) => existingByUserId.get(userId))
		.filter((member): member is NonNullable<typeof member> => !!member && member.leftAt !== null)
		.map((member) => member.id);

	if (rejoinIds.length > 0) {
		await db
			.update(chatChannelMemberTable)
			.set({ leftAt: null })
			.where(inArray(chatChannelMemberTable.id, rejoinIds));
	}

	if (params.mode === "sync") {
		const staleIds = existingMembers
			.filter((member) => member.leftAt === null && !nextUserIds.includes(member.userId))
			.map((member) => member.id);

		if (staleIds.length > 0) {
			await db
				.update(chatChannelMemberTable)
				.set({ leftAt: new Date() })
				.where(inArray(chatChannelMemberTable.id, staleIds));
		}
	}
}

async function setChannelArchivedState(channelId: string, isArchived: boolean, name?: string) {
	await db
		.update(chatChannelTable)
		.set({
			isArchived,
			...(name ? { name } : {}),
		})
		.where(eq(chatChannelTable.id, channelId));
}

export async function ensureTeamConversation(teamId: string) {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { id: true, name: true, tag: true },
	});
	if (!team) return null;

	const existing = await db.query.chatChannelTable.findFirst({
		where: and(eq(chatChannelTable.channelType, "team"), eq(chatChannelTable.teamId, team.id)),
		columns: { id: true, name: true, isArchived: true },
	});

	const channelName = buildTeamChannelName(team);
	let channelId = existing?.id ?? null;

	if (!existing) {
		const [channel] = await db
			.insert(chatChannelTable)
			.values({
				channelType: "team",
				name: channelName,
				teamId: team.id,
			})
			.returning({ id: chatChannelTable.id });
		channelId = channel.id;
	} else if (existing.name !== channelName || existing.isArchived) {
		await setChannelArchivedState(existing.id, false, channelName);
	}

	if (!channelId) return null;

	const memberUserIds = await listActiveRosterUserIds(team.id);
	await syncChannelMembers({
		channelId,
		userIds: memberUserIds,
		mode: "sync",
	});

	return channelId;
}

async function getScrimConversationContext(scrimId: string) {
	return db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		columns: {
			id: true,
			status: true,
			homeTeamId: true,
			awayTeamId: true,
		},
		with: {
			homeTeam: {
				columns: { id: true, name: true, tag: true },
			},
			awayTeam: {
				columns: { id: true, name: true, tag: true },
			},
		},
	});
}

async function ensureScrimConversation(params: {
	scrimId: string;
	channelType: "scrim_negotiation" | "scrim_lobby";
	channelName: string;
	memberUserIds: string[];
	isArchived: boolean;
}) {
	const existing = await db.query.chatChannelTable.findFirst({
		where: and(
			eq(chatChannelTable.scrimId, params.scrimId),
			eq(chatChannelTable.channelType, params.channelType)
		),
		columns: { id: true, name: true, isArchived: true },
	});

	let channelId = existing?.id ?? null;

	if (!existing) {
		const [channel] = await db
			.insert(chatChannelTable)
			.values({
				channelType: params.channelType,
				name: params.channelName,
				scrimId: params.scrimId,
				isArchived: params.isArchived,
			})
			.returning({ id: chatChannelTable.id });
		channelId = channel.id;
	} else if (existing.name !== params.channelName || existing.isArchived !== params.isArchived) {
		await setChannelArchivedState(existing.id, params.isArchived, params.channelName);
	}

	if (!channelId) return null;

	await syncChannelMembers({
		channelId,
		userIds: params.memberUserIds,
		mode: params.channelType === "scrim_lobby" ? "append" : "sync",
	});

	return channelId;
}

async function archiveScrimConversation(
	scrimId: string,
	channelType: "scrim_negotiation" | "scrim_lobby"
) {
	await db
		.update(chatChannelTable)
		.set({ isArchived: true })
		.where(
			and(eq(chatChannelTable.scrimId, scrimId), eq(chatChannelTable.channelType, channelType))
		);
}

export async function ensureScrimConversationLifecycle(scrimId: string) {
	const scrim = await getScrimConversationContext(scrimId);
	if (!scrim) return null;
	if (!scrim.awayTeamId || !scrim.awayTeam) return scrim;

	if (scrim.status === "pending") {
		const managerIds = [
			...(await listTeamAdminUserIds(scrim.homeTeamId)),
			...(await listTeamAdminUserIds(scrim.awayTeamId)),
		];
		await ensureScrimConversation({
			scrimId,
			channelType: "scrim_negotiation",
			channelName: buildScrimChannelName("scrim_negotiation", {
				homeTeam: scrim.homeTeam,
				awayTeam: scrim.awayTeam,
			}),
			memberUserIds: managerIds,
			isArchived: false,
		});
		return scrim;
	}

	const rosterUserIds = [
		...(await listActiveRosterUserIds(scrim.homeTeamId)),
		...(await listActiveRosterUserIds(scrim.awayTeamId)),
	];
	await ensureScrimConversation({
		scrimId,
		channelType: "scrim_lobby",
		channelName: buildScrimChannelName("scrim_lobby", {
			homeTeam: scrim.homeTeam,
			awayTeam: scrim.awayTeam,
		}),
		memberUserIds: rosterUserIds,
		isArchived: scrim.status === "cancelled",
	});
	await archiveScrimConversation(scrimId, "scrim_negotiation");

	if (scrim.status === "cancelled") {
		await archiveScrimConversation(scrimId, "scrim_lobby");
	}

	return scrim;
}

export async function listTeamConversationsForUser(teamId: string, userId: string) {
	await ensureTeamConversation(teamId);

	const scrims = await db.query.scrimTable.findMany({
		where: or(eq(scrimTable.homeTeamId, teamId), eq(scrimTable.awayTeamId, teamId)),
		columns: { id: true },
		limit: 100,
	});
	const scrimIds = new Set(scrims.map((scrim) => scrim.id));

	const conversations = await listConversationsForUser(userId);
	return conversations
		.filter((conversation) => {
			if (conversation.type === "team") {
				return conversation.teamId === teamId;
			}
			return conversation.scrimId ? scrimIds.has(conversation.scrimId) : false;
		})
		.sort((left, right) => {
			if (left.type === "team" && right.type !== "team") return -1;
			if (right.type === "team" && left.type !== "team") return 1;

			const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
			const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
			return rightTime - leftTime;
		});
}

export async function listScrimConversationsForUser(scrimId: string, userId: string) {
	await ensureScrimConversationLifecycle(scrimId);

	const conversations = await listConversationsForUser(userId);
	return conversations
		.filter((conversation) => conversation.scrimId === scrimId)
		.sort((left, right) => {
			if (left.type === "scrim_lobby" && right.type !== "scrim_lobby") return -1;
			if (right.type === "scrim_lobby" && left.type !== "scrim_lobby") return 1;

			const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
			const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
			return rightTime - leftTime;
		});
}

async function computeUnreadCount(
	channelId: string,
	userId: string,
	lastReadAt: Date | null
): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(chatMessageTable)
		.where(
			and(
				eq(chatMessageTable.channelId, channelId),
				ne(chatMessageTable.senderId, userId),
				lastReadAt ? gt(chatMessageTable.createdAt, lastReadAt) : undefined
			)
		);

	return Number(row?.value ?? 0);
}

function parseCursor(cursor?: string): { createdAt: Date; id: string } | null {
	if (!cursor) return null;
	const [createdAtRaw, id] = cursor.split("::");
	if (!createdAtRaw || !id) return null;

	const createdAt = new Date(createdAtRaw);
	if (Number.isNaN(createdAt.getTime())) return null;
	return { createdAt, id };
}

function createCursor(createdAt: Date, id: string): string {
	return `${createdAt.toISOString()}::${id}`;
}

export async function listConversationsForUser(userId: string) {
	const memberships = await db.query.chatChannelMemberTable.findMany({
		where: and(eq(chatChannelMemberTable.userId, userId), isNull(chatChannelMemberTable.leftAt)),
		with: {
			channel: {
				columns: {
					id: true,
					channelType: true,
					name: true,
					isArchived: true,
					scrimId: true,
					teamId: true,
					recruitmentApplicationId: true,
				},
				with: {
					messages: {
						orderBy: [desc(chatMessageTable.createdAt)],
						limit: 1,
					},
					members: {
						where: isNull(chatChannelMemberTable.leftAt),
					},
				},
			},
		},
	});

	const unreadCounts = await Promise.all(
		memberships.map((membership) =>
			computeUnreadCount(membership.channelId, userId, membership.lastReadAt ?? null)
		)
	);

	return memberships
		.map((membership, index) => {
			const channel = membership.channel;
			const lastMessage = channel?.messages[0];

			return {
				id: membership.channelId,
				type: channel?.channelType ?? "direct",
				name: channel?.name ?? "Conversation",
				isArchived: channel?.isArchived ?? false,
				scrimId: channel?.scrimId ?? null,
				teamId: channel?.teamId ?? null,
				recruitmentApplicationId: channel?.recruitmentApplicationId ?? null,
				lastMessagePreview: lastMessage
					? normalizeMessageContent(lastMessage.content, lastMessage.deletedAt ?? null)
					: null,
				lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
				unreadCount: unreadCounts[index] ?? 0,
				participantCount: channel?.members.length ?? 0,
				membershipCreatedAt: membership.createdAt,
			};
		})
		.sort((a, b) => {
			const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
			const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
			if (aTime !== bTime) return bTime - aTime;
			return b.membershipCreatedAt.getTime() - a.membershipCreatedAt.getTime();
		})
		.map(({ membershipCreatedAt: _membershipCreatedAt, ...conversation }) => {
			return conversation;
		});
}

export async function hasConversationAccess(conversationId: string, userId: string) {
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, conversationId),
			eq(chatChannelMemberTable.userId, userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true },
	});
	return Boolean(membership);
}

export async function listConversationMembers(conversationId: string) {
	const members = await db.query.chatChannelMemberTable.findMany({
		where: and(
			eq(chatChannelMemberTable.channelId, conversationId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { userId: true, isMuted: true },
	});
	return members;
}

export async function getConversationDetailForUser(conversationId: string, userId: string) {
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, conversationId),
			eq(chatChannelMemberTable.userId, userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true, lastReadAt: true },
	});
	if (!membership) return null;

	const channel = await db.query.chatChannelTable.findFirst({
		where: eq(chatChannelTable.id, conversationId),
		columns: {
			id: true,
			channelType: true,
			name: true,
			isArchived: true,
			scrimId: true,
			teamId: true,
			recruitmentApplicationId: true,
		},
		with: {
			members: {
				where: isNull(chatChannelMemberTable.leftAt),
				with: {
					user: { columns: { id: true, displayName: true, avatarUrl: true } },
				},
			},
			messages: {
				orderBy: [desc(chatMessageTable.createdAt)],
				limit: 1,
			},
		},
	});
	if (!channel) return null;

	return {
		id: channel.id,
		type: channel.channelType,
		name: channel.name,
		isArchived: channel.isArchived,
		scrimId: channel.scrimId ?? null,
		teamId: channel.teamId ?? null,
		recruitmentApplicationId: channel.recruitmentApplicationId ?? null,
		lastMessagePreview: channel.messages[0]
			? normalizeMessageContent(channel.messages[0].content, channel.messages[0].deletedAt ?? null)
			: null,
		lastMessageAt: channel.messages[0]?.createdAt.toISOString() ?? null,
		unreadCount: await computeUnreadCount(conversationId, userId, membership.lastReadAt ?? null),
		participantCount: channel.members.length,
		participants: channel.members.map((member) => ({
			userId: member.user.id,
			displayName: member.user.displayName,
			avatarUrl: member.user.avatarUrl,
			role: member.role,
			joinedAt: member.createdAt.toISOString(),
			leftAt: member.leftAt?.toISOString() ?? null,
		})),
	};
}

export async function getConversationSummaryForUser(
	conversationId: string,
	userId: string
): Promise<ChatConversationSummary | null> {
	const detail = await getConversationDetailForUser(conversationId, userId);
	if (!detail) return null;

	const { participants: _participants, ...summary } = detail;
	return summary;
}

export async function listMessagesForUser(params: {
	conversationId: string;
	userId: string;
	cursor?: string;
	limit: number;
}) {
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, params.conversationId),
			eq(chatChannelMemberTable.userId, params.userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true },
	});
	if (!membership) return { status: "not_found" } as const;

	const cursor = parseCursor(params.cursor);
	if (params.cursor && !cursor) return { status: "invalid_cursor" } as const;
	const take = Math.min(Math.max(params.limit, 1), 100);
	const rows = await db.query.chatMessageTable.findMany({
		where: and(
			eq(chatMessageTable.channelId, params.conversationId),
			cursor
				? or(
						lt(chatMessageTable.createdAt, cursor.createdAt),
						and(
							eq(chatMessageTable.createdAt, cursor.createdAt),
							lt(chatMessageTable.id, cursor.id)
						)
					)
				: undefined
		),
		orderBy: [desc(chatMessageTable.createdAt), desc(chatMessageTable.id)],
		limit: take + 1,
		with: {
			sender: { columns: { id: true, displayName: true, avatarUrl: true } },
		},
	});

	const hasMore = rows.length > take;
	const items = (hasMore ? rows.slice(0, take) : rows).reverse();
	const nextCursor = hasMore && items[0] ? createCursor(items[0].createdAt, items[0].id) : null;

	return {
		status: "ok",
		data: {
			items: items.map((message) => ({
				id: message.id,
				conversationId: message.channelId,
				senderId: message.sender.id,
				senderDisplayName: message.sender.displayName,
				senderAvatarUrl: message.sender.avatarUrl,
				content: normalizeMessageContent(message.content, message.deletedAt ?? null),
				replyToMessageId: message.replyToMessageId ?? null,
				isSystemMessage: message.isSystemMessage,
				editedAt: message.editedAt?.toISOString() ?? null,
				deletedAt: message.deletedAt?.toISOString() ?? null,
				createdAt: message.createdAt.toISOString(),
			})),
			nextCursor,
		},
	} as const;
}

export async function createMessageForUser(params: {
	conversationId: string;
	userId: string;
	content: string;
	replyToMessageId?: string;
}) {
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, params.conversationId),
			eq(chatChannelMemberTable.userId, params.userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true },
		with: {
			channel: { columns: { isArchived: true } },
		},
	});
	if (!membership) return { status: "forbidden" } as const;
	if (membership.channel?.isArchived) return { status: "archived" } as const;

	if (params.replyToMessageId) {
		const replyTarget = await db.query.chatMessageTable.findFirst({
			where: and(
				eq(chatMessageTable.id, params.replyToMessageId),
				eq(chatMessageTable.channelId, params.conversationId)
			),
			columns: { id: true },
		});
		if (!replyTarget) return { status: "invalid_reply" } as const;
	}

	const [message] = await db
		.insert(chatMessageTable)
		.values({
			channelId: params.conversationId,
			senderId: params.userId,
			content: params.content,
			replyToMessageId: params.replyToMessageId ?? null,
		})
		.returning({ id: chatMessageTable.id });

	return { status: "ok", messageId: message.id } as const;
}

export async function getMessageByIdForConversation(params: {
	conversationId: string;
	messageId: string;
}) {
	const message = await db.query.chatMessageTable.findFirst({
		where: and(
			eq(chatMessageTable.id, params.messageId),
			eq(chatMessageTable.channelId, params.conversationId)
		),
		with: {
			sender: { columns: { id: true, displayName: true, avatarUrl: true } },
		},
	});
	if (!message) return null;

	return {
		id: message.id,
		conversationId: message.channelId,
		senderId: message.sender.id,
		senderDisplayName: message.sender.displayName,
		senderAvatarUrl: message.sender.avatarUrl,
		content: normalizeMessageContent(message.content, message.deletedAt ?? null),
		replyToMessageId: message.replyToMessageId ?? null,
		isSystemMessage: message.isSystemMessage,
		editedAt: message.editedAt?.toISOString() ?? null,
		deletedAt: message.deletedAt?.toISOString() ?? null,
		createdAt: message.createdAt.toISOString(),
	};
}

export async function markConversationReadForUser(params: {
	conversationId: string;
	userId: string;
	lastReadMessageId?: string;
}) {
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, params.conversationId),
			eq(chatChannelMemberTable.userId, params.userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true },
	});
	if (!membership) return { status: "not_found" } as const;

	const lastReadAt = params.lastReadMessageId
		? await db.query.chatMessageTable.findFirst({
				where: and(
					eq(chatMessageTable.id, params.lastReadMessageId),
					eq(chatMessageTable.channelId, params.conversationId)
				),
				columns: { createdAt: true },
			})
		: null;
	if (params.lastReadMessageId && !lastReadAt) return { status: "invalid_message" } as const;

	await db
		.update(chatChannelMemberTable)
		.set({ lastReadAt: lastReadAt?.createdAt ?? new Date() })
		.where(eq(chatChannelMemberTable.id, membership.id));

	return { status: "ok" } as const;
}

/** Find an existing direct conversation between two users, or create one. */
export async function findOrCreateDirectConversation(
	userId: string,
	targetUserId: string
): Promise<{ conversationId: string; isNew: boolean }> {
	// Find a channel of type "direct" where both users are active members
	const userMemberships = await db.query.chatChannelMemberTable.findMany({
		where: and(eq(chatChannelMemberTable.userId, userId), isNull(chatChannelMemberTable.leftAt)),
		columns: { channelId: true },
		with: {
			channel: {
				columns: { id: true, channelType: true },
			},
		},
	});

	const directChannelIds = userMemberships
		.filter((m) => m.channel?.channelType === "direct")
		.map((m) => m.channelId);

	if (directChannelIds.length > 0) {
		const sharedMembership = await db.query.chatChannelMemberTable.findFirst({
			where: and(
				eq(chatChannelMemberTable.userId, targetUserId),
				isNull(chatChannelMemberTable.leftAt),
				inArray(chatChannelMemberTable.channelId, directChannelIds)
			),
			columns: { channelId: true },
		});

		if (sharedMembership) {
			return { conversationId: sharedMembership.channelId, isNew: false };
		}
	}

	// Create new direct channel
	const [channel] = await db
		.insert(chatChannelTable)
		.values({ channelType: "direct", name: "Direct Message" })
		.returning({ id: chatChannelTable.id });

	await db.insert(chatChannelMemberTable).values([
		{ channelId: channel.id, userId },
		{ channelId: channel.id, userId: targetUserId },
	]);

	return { conversationId: channel.id, isNew: true };
}

/** Edit the content of a message the user sent. */
export async function editMessageForUser(params: {
	conversationId: string;
	messageId: string;
	userId: string;
	content: string;
}): Promise<{ status: "ok" | "not_found" | "forbidden" | "deleted" }> {
	const message = await db.query.chatMessageTable.findFirst({
		where: and(
			eq(chatMessageTable.id, params.messageId),
			eq(chatMessageTable.channelId, params.conversationId)
		),
		columns: { senderId: true, deletedAt: true },
	});

	if (!message) return { status: "not_found" };
	if (message.senderId !== params.userId) return { status: "forbidden" };
	if (message.deletedAt) return { status: "deleted" };

	await db
		.update(chatMessageTable)
		.set({ content: params.content, editedAt: new Date() })
		.where(eq(chatMessageTable.id, params.messageId));

	return { status: "ok" };
}

/** Soft-delete a message. Only the sender can delete their own messages. */
export async function deleteMessageForUser(params: {
	conversationId: string;
	messageId: string;
	userId: string;
}): Promise<{ status: "ok" | "not_found" | "forbidden" }> {
	const message = await db.query.chatMessageTable.findFirst({
		where: and(
			eq(chatMessageTable.id, params.messageId),
			eq(chatMessageTable.channelId, params.conversationId)
		),
		columns: { senderId: true, deletedAt: true },
	});

	if (!message) return { status: "not_found" };
	if (message.senderId !== params.userId) return { status: "forbidden" };

	await db
		.update(chatMessageTable)
		.set({ deletedAt: new Date() })
		.where(eq(chatMessageTable.id, params.messageId));

	return { status: "ok" };
}

/** Upsert per-message read receipts and update the member's lastReadAt. */
export async function markMessagesReadForUser(params: {
	conversationId: string;
	userId: string;
	messageIds: string[];
}): Promise<void> {
	if (params.messageIds.length === 0) return;

	// Verify membership
	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, params.conversationId),
			eq(chatChannelMemberTable.userId, params.userId),
			isNull(chatChannelMemberTable.leftAt)
		),
		columns: { id: true },
	});
	if (!membership) return;

	const now = new Date();

	// Upsert read receipts (ignore conflicts — already read)
	await db
		.insert(chatMessageReadTable)
		.values(
			params.messageIds.map((messageId) => ({ messageId, userId: params.userId, readAt: now }))
		)
		.onConflictDoNothing();
}

/** Get the list of users who have read a specific message. */
export async function getMessageReaders(
	messageId: string
): Promise<Array<{ userId: string; readAt: string }>> {
	const rows = await db.query.chatMessageReadTable.findMany({
		where: eq(chatMessageReadTable.messageId, messageId),
		columns: { userId: true, readAt: true },
	});
	return rows.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() }));
}
