import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chatChannelMemberTable, chatMessageReadTable, chatMessageTable } from "@/db/schema";

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
