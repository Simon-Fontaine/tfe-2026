import { and, count, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { chatChannelMemberTable, chatChannelTable, chatMessageTable } from "@/db/schema";

function normalizeMessageContent(content: string, deletedAt: Date | null): string {
	if (deletedAt) return "[deleted]";
	return content;
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
					lfgApplicationId: true,
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
				lfgApplicationId: channel?.lfgApplicationId ?? null,
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
			lfgApplicationId: true,
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
		lfgApplicationId: channel.lfgApplicationId ?? null,
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
