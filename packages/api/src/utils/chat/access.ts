import { and, count, desc, eq, gt, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { chatChannelMemberTable, chatChannelTable, chatMessageTable } from "@/db/schema";
import { getUsersPresence } from "@/realtime/presence";

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
					user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
				},
			},
			messages: {
				orderBy: [desc(chatMessageTable.createdAt)],
				limit: 1,
			},
		},
	});
	if (!channel) return null;

	const presences = await getUsersPresence(channel.members.map((member) => member.user.id));
	const statusByUserId = new Map(presences.map((presence) => [presence.userId, presence.status]));

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
			username: member.user.username,
			displayName: member.user.displayName,
			avatarUrl: member.user.avatarUrl,
			role: member.role,
			status: statusByUserId.get(member.user.id) ?? "offline",
			joinedAt: member.createdAt.toISOString(),
			leftAt: member.leftAt?.toISOString() ?? null,
		})),
	};
}
