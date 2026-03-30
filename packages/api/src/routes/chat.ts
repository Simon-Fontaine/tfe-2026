import { ReadConversationSchema, SendChatMessageSchema } from "@scrimflow/shared";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import * as v from "valibot";

import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import {
	publishConversationEvent,
	publishUserEvent,
	registerChatSocket,
	subscribeSocketToConversation,
	unregisterChatSocket,
	unsubscribeSocketFromConversation,
} from "@/realtime/chat-hub";
import { extractErrors } from "@/routes/auth/utils";
import {
	createMessageForUser,
	getConversationDetailForUser,
	getMessageByIdForConversation,
	hasConversationAccess,
	listConversationMembers,
	listConversationsForUser,
	listMessagesForUser,
	markConversationReadForUser,
} from "@/utils/chat";

const chatRoutes = new Hono<AuthEnv>();

type ChatSocketCommand =
	| { type: "subscribe"; conversationId: string }
	| { type: "unsubscribe"; conversationId: string }
	| { type: "typing"; conversationId: string; isTyping: boolean }
	| { type: "ping" };

chatRoutes.get(
	"/ws",
	upgradeWebSocket((c) => {
		const user = c.get("user");

		async function handleCommand(raw: string, ws: { send: (value: string) => void }) {
			const parsed = JSON.parse(raw) as ChatSocketCommand;
			if (!parsed?.type) {
				ws.send(JSON.stringify({ type: "chat.error", error: "Invalid websocket payload." }));
				return;
			}

			if (parsed.type === "ping") {
				ws.send(JSON.stringify({ type: "chat.pong" }));
				return;
			}

			if (!("conversationId" in parsed) || !parsed.conversationId) {
				ws.send(JSON.stringify({ type: "chat.error", error: "conversationId is required." }));
				return;
			}

			const hasAccess = await hasConversationAccess(parsed.conversationId, user.id);
			if (!hasAccess) {
				ws.send(
					JSON.stringify({
						type: "chat.error",
						error: "You do not have access to this conversation.",
						conversationId: parsed.conversationId,
					})
				);
				return;
			}

			if (parsed.type === "subscribe") {
				subscribeSocketToConversation(ws, parsed.conversationId);
				return;
			}

			if (parsed.type === "unsubscribe") {
				unsubscribeSocketFromConversation(ws, parsed.conversationId);
				return;
			}

			if (parsed.type === "typing") {
				publishConversationEvent({
					conversationId: parsed.conversationId,
					event: "conversation.typing",
					excludeUserId: user.id,
					payload: { userId: user.id, isTyping: parsed.isTyping },
				});
			}
		}

		return {
			onOpen(_event, ws) {
				registerChatSocket(ws, user.id);
			},
			onMessage(event, ws) {
				void handleCommand(event.data.toString(), ws).catch(() => {
					ws.send(JSON.stringify({ type: "chat.error", error: "Unable to process command." }));
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

	publishConversationEvent({
		conversationId,
		event: "conversation.message.created",
		payload: { message },
	});

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

		publishUserEvent({
			userId: member.userId,
			event: "notification.created",
			payload: {
				notificationType: "new_message",
				conversationId,
				message,
				senderId: user.id,
			},
		});
	}

	return c.json({ success: true, messageId: result.messageId });
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

	publishConversationEvent({
		conversationId,
		event: "conversation.read.updated",
		excludeUserId: user.id,
		payload: {
			userId: user.id,
			lastReadMessageId: parsed.output.lastReadMessageId ?? null,
		},
	});

	return c.json({ success: true });
});

export { chatRoutes };
