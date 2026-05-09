import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chatChannelMemberTable, chatChannelTable, chatMessageTable } from "@/db/schema";

function normalizeMessageContent(content: string, deletedAt: Date | null): string {
	if (deletedAt) return "[deleted]";
	return content;
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
