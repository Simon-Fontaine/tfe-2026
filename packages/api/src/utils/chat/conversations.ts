import type { ChatConversationSummary } from "@scrimflow/shared";
import { and, count, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { chatChannelMemberTable, chatMessageTable, scrimTable } from "@/db/schema";
import { getConversationDetailForUser } from "./access";
import { ensureScrimConversationLifecycle, ensureTeamConversation } from "./lifecycle";

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
				or(isNull(chatMessageTable.senderId), ne(chatMessageTable.senderId, userId)),
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
				senderId: message.sender?.id ?? null,
				senderDisplayName: message.isSystemMessage
					? "System"
					: (message.sender?.displayName ?? "[deleted user]"),
				senderAvatarUrl: message.sender?.avatarUrl ?? null,
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
