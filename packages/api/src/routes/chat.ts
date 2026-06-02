import {
	CreateDirectConversationSchema,
	EditChatMessageSchema,
	ReadConversationSchema,
	SendChatMessageSchema,
	TEAM_VIEWABLE_STATUSES,
} from "@scrimflow/shared";
import { Hono } from "hono";
import * as v from "valibot";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification, markChatChannelNotificationsRead } from "@/notifications";
import {
	isUserSubscribedToConversation,
	publishConversationEvent,
	publishUserEvent,
} from "@/realtime/chat-hub";
import { getUserPresence } from "@/realtime/presence";
import { extractErrors } from "@/routes/auth/utils";
import {
	createMessageForUser,
	deleteMessageForUser,
	editMessageForUser,
	ensureScrimConversationLifecycle,
	findOrCreateDirectConversation,
	getConversationDetailForUser,
	getConversationSummaryForUser,
	getMessageByIdForConversation,
	listConversationMembers,
	listConversationsForUser,
	listMessagesForUser,
	listScrimConversationsForUser,
	listTeamConversationsForUser,
	markConversationReadForUser,
	markMessagesReadForUser,
} from "@/utils/chat";
import { getTeamAccessContext, isUserOnTeam } from "@/utils/team";

const chatRoutes = new Hono<AuthEnv>();

async function publishConversationMutationToMembers(params: {
	conversationId: string;
	members: Awaited<ReturnType<typeof listConversationMembers>>;
	actorUserId: string;
	event: "conversation:message-updated";
	message: NonNullable<Awaited<ReturnType<typeof getMessageByIdForConversation>>>;
}): Promise<void>;
async function publishConversationMutationToMembers(params: {
	conversationId: string;
	members: Awaited<ReturnType<typeof listConversationMembers>>;
	actorUserId: string;
	event: "conversation:message-deleted";
	messageId: string;
	deletedAt: string;
}): Promise<void>;
async function publishConversationMutationToMembers(params: {
	conversationId: string;
	members: Awaited<ReturnType<typeof listConversationMembers>>;
	actorUserId: string;
	event: "conversation:message-updated" | "conversation:message-deleted";
	message?: NonNullable<Awaited<ReturnType<typeof getMessageByIdForConversation>>>;
	messageId?: string;
	deletedAt?: string;
}) {
	await Promise.all(
		params.members.map(async (member) => {
			const conversation = await getConversationSummaryForUser(
				params.conversationId,
				member.userId
			);
			if (!conversation) return;

			if (params.event === "conversation:message-updated" && params.message) {
				publishUserEvent({
					userId: member.userId,
					event: params.event,
					payload: {
						conversationId: params.conversationId,
						message: params.message,
						actorUserId: params.actorUserId,
						conversation,
					},
				});
				return;
			}

			if (params.event === "conversation:message-deleted" && params.messageId && params.deletedAt) {
				publishUserEvent({
					userId: member.userId,
					event: params.event,
					payload: {
						conversationId: params.conversationId,
						messageId: params.messageId,
						deletedAt: params.deletedAt,
						actorUserId: params.actorUserId,
						conversation,
					},
				});
			}
		})
	);
}

chatRoutes.get("/conversations", async (c) => {
	const user = c.get("user");
	return c.json({ data: await listConversationsForUser(user.id) });
});

chatRoutes.get("/teams/:teamId/conversations", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("teamId");
	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);

	const canView = access.canManageTeam
		? true
		: access.teamStatus
			? TEAM_VIEWABLE_STATUSES.includes(
					access.teamStatus as (typeof TEAM_VIEWABLE_STATUSES)[number]
				)
			: false;
	if (!canView) {
		return c.json({ error: "You do not have access to this team's chat workspace." }, 403);
	}

	return c.json({
		data: await listTeamConversationsForUser(teamId, user.id),
	});
});

chatRoutes.get("/scrims/:scrimId/conversations", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("scrimId");
	const scrim = await ensureScrimConversationLifecycle(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);

	const canAccess =
		(await isUserOnTeam(user.id, scrim.homeTeamId)) ||
		(scrim.awayTeamId ? await isUserOnTeam(user.id, scrim.awayTeamId) : false);
	if (!canAccess) {
		return c.json({ error: "You do not have access to this scrim." }, 403);
	}

	return c.json({
		data: await listScrimConversationsForUser(scrimId, user.id),
	});
});

chatRoutes.get("/conversations/:id", async (c) => {
	const user = c.get("user");
	const conversation = await getConversationDetailForUser(c.req.param("id"), user.id);
	if (!conversation) return c.json({ error: "Conversation not found." }, 404);
	return c.json({ data: conversation });
});

/** Create or find a direct (1:1) conversation with another user. */
chatRoutes.post("/conversations/direct", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateDirectConversationSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	if (parsed.output.targetUserId === user.id) {
		return c.json({ error: "Cannot start a conversation with yourself." }, 400);
	}

	const result = await findOrCreateDirectConversation(user.id, parsed.output.targetUserId);
	return c.json({ data: result });
});

chatRoutes.get("/conversations/:id/messages", async (c) => {
	const user = c.get("user");
	const limitQuery = c.req.query("limit");
	const limitParam = Number(limitQuery ?? 30);
	if (limitQuery && (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 100)) {
		return c.json({ error: "Limit must be an integer between 1 and 100." }, 400);
	}
	const messages = await listMessagesForUser({
		conversationId: c.req.param("id"),
		userId: user.id,
		cursor: c.req.query("cursor"),
		limit: Number.isFinite(limitParam) ? limitParam : 30,
	});
	if (messages.status === "not_found") return c.json({ error: "Conversation not found." }, 404);
	if (messages.status === "invalid_cursor")
		return c.json({ error: "Cursor must be in the format <ISO_DATE>::<MESSAGE_ID>." }, 400);
	return c.json({ data: messages.data });
});

chatRoutes.post("/conversations/:id/messages", async (c) => {
	const user = c.get("user");
	const conversationId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(SendChatMessageSchema, { ...body, conversationId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const result = await createMessageForUser({
		conversationId,
		userId: user.id,
		content: parsed.output.content,
		replyToMessageId: parsed.output.replyToMessageId,
		clientNonce: parsed.output.clientNonce,
	});
	if (result.status === "forbidden")
		return c.json({ error: "You cannot message this conversation." }, 403);
	if (result.status === "archived")
		return c.json({ error: "This conversation is archived and read-only." }, 403);
	if (result.status === "invalid_reply")
		return c.json({ error: "The reply target message was not found in this conversation." }, 400);
	if (result.status === "error") return c.json({ error: "Failed to send message." }, 500);

	const message = await getMessageByIdForConversation({
		conversationId,
		messageId: result.messageId,
	});
	const realtimeMessage =
		message && parsed.output.clientNonce
			? { ...message, clientNonce: parsed.output.clientNonce }
			: message;
	const members = await listConversationMembers(conversationId);

	if (realtimeMessage) {
		publishConversationEvent({
			conversationId,
			event: "message:new",
			payload: { message: realtimeMessage },
		});
	}

	for (const member of members) {
		if (realtimeMessage) {
			const conversation = await getConversationSummaryForUser(conversationId, member.userId);
			if (!conversation) continue;

			publishUserEvent({
				userId: member.userId,
				event: "conversation:message-created",
				payload: {
					conversationId,
					message: realtimeMessage,
					senderId: user.id,
					conversation,
				},
			});

			// Skip self, muted members, and anyone currently viewing the room.
			if (
				member.userId === user.id ||
				member.isMuted ||
				isUserSubscribedToConversation(conversationId, member.userId)
			) {
				continue;
			}

			await createNotification({
				userId: member.userId,
				type: "new_message",
				title: "New message",
				body: parsed.output.content.slice(0, 180),
				referenceType: "chat_channel",
				referenceId: conversationId,
			});

			publishUserEvent({
				userId: member.userId,
				event: "notification:new",
				payload: {
					notificationType: "new_message",
					conversationId,
					message: realtimeMessage,
					senderId: user.id,
					conversation,
				},
			});
		}
	}

	return c.json({ success: true, messageId: result.messageId });
});

/** Edit a message the authenticated user sent. */
chatRoutes.patch("/conversations/:id/messages/:messageId", async (c) => {
	const user = c.get("user");
	const conversationId = c.req.param("id");
	const messageId = c.req.param("messageId");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(EditChatMessageSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const result = await editMessageForUser({
		conversationId,
		messageId,
		userId: user.id,
		content: parsed.output.content,
	});

	if (result.status === "not_found") return c.json({ error: "Message not found." }, 404);
	if (result.status === "archived")
		return c.json({ error: "This conversation is archived and read-only." }, 403);
	if (result.status === "forbidden")
		return c.json({ error: "You can only edit your own messages." }, 403);
	if (result.status === "deleted") return c.json({ error: "Cannot edit a deleted message." }, 400);

	const message = await getMessageByIdForConversation({ conversationId, messageId });
	if (message) {
		publishConversationEvent({
			conversationId,
			event: "message:updated",
			payload: { message },
		});

		const members = await listConversationMembers(conversationId);
		await publishConversationMutationToMembers({
			conversationId,
			members,
			actorUserId: user.id,
			event: "conversation:message-updated",
			message,
		});
	}

	return c.json({ success: true });
});

/** Soft-delete a message the authenticated user sent. */
chatRoutes.delete("/conversations/:id/messages/:messageId", async (c) => {
	const user = c.get("user");
	const conversationId = c.req.param("id");
	const messageId = c.req.param("messageId");

	const result = await deleteMessageForUser({ conversationId, messageId, userId: user.id });

	if (result.status === "not_found") return c.json({ error: "Message not found." }, 404);
	if (result.status === "archived")
		return c.json({ error: "This conversation is archived and read-only." }, 403);
	if (result.status === "forbidden")
		return c.json({ error: "You can only delete your own messages." }, 403);

	const deletedMessage = await getMessageByIdForConversation({ conversationId, messageId });
	const deletedAt = deletedMessage?.deletedAt ?? new Date().toISOString();

	publishConversationEvent({
		conversationId,
		event: "message:deleted",
		payload: { messageId, deletedAt },
	});

	const members = await listConversationMembers(conversationId);
	await publishConversationMutationToMembers({
		conversationId,
		members,
		actorUserId: user.id,
		event: "conversation:message-deleted",
		messageId,
		deletedAt,
	});

	return c.json({ success: true });
});

chatRoutes.post("/conversations/:id/read", async (c) => {
	const user = c.get("user");
	const conversationId = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));

	const parsed = v.safeParse(ReadConversationSchema, { ...body, conversationId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const result = await markConversationReadForUser({
		conversationId,
		userId: user.id,
		lastReadMessageId: parsed.output.lastReadMessageId,
	});
	if (result.status === "not_found") return c.json({ error: "Conversation not found." }, 404);
	if (result.status === "invalid_message")
		return c.json({ error: "Invalid last read message for this conversation." }, 400);

	// Clear any unread message notifications for this conversation so the inbox
	// badge doesn't linger while the user is reading the chat.
	void markChatChannelNotificationsRead(user.id, conversationId);

	// Upsert per-message receipt if a specific message ID was provided
	if (parsed.output.lastReadMessageId) {
		await markMessagesReadForUser({
			conversationId,
			userId: user.id,
			messageIds: [parsed.output.lastReadMessageId],
		});
	}

	publishConversationEvent({
		conversationId,
		event: "message:read",
		excludeUserId: user.id,
		payload: {
			userId: user.id,
			lastReadMessageId: parsed.output.lastReadMessageId ?? null,
		},
	});

	return c.json({ success: true });
});

chatRoutes.get("/presence/:userId", async (c) => {
	const presence = await getUserPresence(c.req.param("userId"));
	return c.json({ data: presence });
});

export { chatRoutes };
