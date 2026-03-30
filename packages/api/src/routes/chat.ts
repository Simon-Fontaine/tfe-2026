import {
	CreateDirectConversationSchema,
	EditChatMessageSchema,
	ReadConversationSchema,
	SendChatMessageSchema,
} from "@scrimflow/shared";
import { Hono } from "hono";
import * as v from "valibot";

import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import {
	publishConversationEvent,
	publishUserEvent,
	refreshSocketPresence,
	registerChatSocket,
	subscribeSocketToConversation,
	unregisterChatSocket,
	unsubscribeSocketFromConversation,
} from "@/realtime/chat-hub";
import { getUserPresence } from "@/realtime/presence";
import { extractErrors } from "@/routes/auth/utils";
import {
	createMessageForUser,
	deleteMessageForUser,
	editMessageForUser,
	findOrCreateDirectConversation,
	getConversationDetailForUser,
	getMessageByIdForConversation,
	hasConversationAccess,
	listConversationMembers,
	listConversationsForUser,
	listMessagesForUser,
	markConversationReadForUser,
	markMessagesReadForUser,
} from "@/utils/chat";
import { upgradeWebSocket } from "@/websocket";

const chatRoutes = new Hono<AuthEnv>();

// ─── WebSocket ────────────────────────────────────────────────────────────────

type ChatSocketCommand =
	| { type: "subscribe"; conversationId: string }
	| { type: "unsubscribe"; conversationId: string }
	| { type: "typing:start"; conversationId: string }
	| { type: "typing:stop"; conversationId: string }
	| { type: "presence:heartbeat" }
	| { type: "ping" };

chatRoutes.get(
	"/ws",
	upgradeWebSocket((c) => {
		const user = c.get("user");

		async function handleCommand(raw: string, ws: { send: (value: string) => void }) {
			const parsed = JSON.parse(raw) as ChatSocketCommand;
			if (!parsed?.type) {
				ws.send(JSON.stringify({ type: "chat:error", error: "Invalid websocket payload." }));
				return;
			}

			if (parsed.type === "ping") {
				ws.send(JSON.stringify({ type: "chat:pong" }));
				return;
			}

			if (parsed.type === "presence:heartbeat") {
				refreshSocketPresence(ws as { send: (payload: string) => unknown });
				return;
			}

			if (!("conversationId" in parsed) || !parsed.conversationId) {
				ws.send(JSON.stringify({ type: "chat:error", error: "conversationId is required." }));
				return;
			}

			const hasAccess = await hasConversationAccess(parsed.conversationId, user.id);
			if (!hasAccess) {
				ws.send(
					JSON.stringify({
						type: "chat:error",
						error: "You do not have access to this conversation.",
						conversationId: parsed.conversationId,
					})
				);
				return;
			}

			if (parsed.type === "subscribe") {
				subscribeSocketToConversation(
					ws as { send: (payload: string) => unknown },
					parsed.conversationId
				);
				return;
			}

			if (parsed.type === "unsubscribe") {
				unsubscribeSocketFromConversation(
					ws as { send: (payload: string) => unknown },
					parsed.conversationId
				);
				return;
			}

			if (parsed.type === "typing:start") {
				publishConversationEvent({
					conversationId: parsed.conversationId,
					event: "typing:start",
					excludeUserId: user.id,
					payload: { userId: user.id },
				});
				return;
			}

			if (parsed.type === "typing:stop") {
				publishConversationEvent({
					conversationId: parsed.conversationId,
					event: "typing:stop",
					excludeUserId: user.id,
					payload: { userId: user.id },
				});
			}
		}

		return {
			onOpen(_event, ws) {
				registerChatSocket(ws, user.id);
			},
			onMessage(event, ws) {
				void handleCommand(event.data.toString(), ws).catch(() => {
					ws.send(JSON.stringify({ type: "chat:error", error: "Unable to process command." }));
				});
			},
			onClose(_event, ws) {
				unregisterChatSocket(ws);
			},
			onError(_event, ws) {
				unregisterChatSocket(ws);
			},
		};
	})
);

// ─── Conversations ────────────────────────────────────────────────────────────

chatRoutes.get("/conversations", async (c) => {
	const user = c.get("user");
	return c.json({ data: await listConversationsForUser(user.id) });
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

// ─── Messages ─────────────────────────────────────────────────────────────────

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
	});
	if (result.status === "forbidden")
		return c.json({ error: "You cannot message this conversation." }, 403);
	if (result.status === "archived")
		return c.json({ error: "This conversation is archived and read-only." }, 403);
	if (result.status === "invalid_reply")
		return c.json({ error: "The reply target message was not found in this conversation." }, 400);

	const message = await getMessageByIdForConversation({
		conversationId,
		messageId: result.messageId,
	});
	const members = await listConversationMembers(conversationId);

	if (message) {
		publishConversationEvent({
			conversationId,
			event: "message:new",
			payload: { message },
		});
	}

	for (const member of members) {
		if (member.userId === user.id) continue;
		if (member.isMuted) continue;

		await createNotification({
			userId: member.userId,
			type: "new_message",
			title: "New message",
			body: parsed.output.content.slice(0, 180),
			referenceType: "chat_channel",
			referenceId: conversationId,
		});

		if (message) {
			publishUserEvent({
				userId: member.userId,
				event: "notification:new",
				payload: {
					notificationType: "new_message",
					conversationId,
					message,
					senderId: user.id,
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
	if (result.status === "forbidden")
		return c.json({ error: "You can only delete your own messages." }, 403);

	publishConversationEvent({
		conversationId,
		event: "message:deleted",
		payload: { messageId, deletedAt: new Date().toISOString() },
	});

	return c.json({ success: true });
});

// ─── Read state ───────────────────────────────────────────────────────────────

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

// ─── Presence ─────────────────────────────────────────────────────────────────

chatRoutes.get("/presence/:userId", async (c) => {
	const presence = await getUserPresence(c.req.param("userId"));
	return c.json({ data: presence });
});

export { chatRoutes };
