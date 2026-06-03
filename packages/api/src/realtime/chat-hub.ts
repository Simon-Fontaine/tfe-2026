import type { RealtimeSessionInvalidationReason } from "@scrimflow/shared";
import redis from "@/db/redis";
import logger from "@/utils/logger";
import { refreshPresence, setUserOffline, setUserOnline } from "./presence";

/**
 * Chat pub/sub hub.
 *
 * Architecture:
 * - In-memory Maps provide fast local fan-out within a single process.
 * - Redis pub/sub bridges events across multiple API processes.
 *   Channels: `chat:conv:{conversationId}` and `chat:user:{userId}`
 */

type ChatSocket = {
	send: (payload: string) => unknown;
	close?: (code?: number, reason?: string) => unknown;
};

type SocketMeta = {
	sessionId: string;
	userId: string;
	subscriptions: Set<string>;
};

const socketMeta = new Map<ChatSocket, SocketMeta>();
const sessionSockets = new Map<string, Set<ChatSocket>>();
const userSockets = new Map<string, Set<ChatSocket>>();
const conversationSockets = new Map<string, Set<ChatSocket>>();

function createRedisSubscriber() {
	const client = redis.duplicate();
	client.on("error", (err: Error) => {
		logger.error({ err }, "chat-hub redis subscriber error");
	});
	return client;
}

// Dedicated subscriber connection (cannot share with publisher)
const redisSubscriber = createRedisSubscriber();

redisSubscriber.on("message", (channel: string, message: string) => {
	try {
		const parsed = JSON.parse(message) as {
			event: string;
			payload: Record<string, unknown>;
			excludeUserId?: string;
		};

		if (channel.startsWith("chat:conv:")) {
			const conversationId = channel.slice("chat:conv:".length);
			localFanOutConversation(conversationId, parsed.event, parsed.payload, parsed.excludeUserId);
		} else if (channel.startsWith("chat:user:")) {
			const userId = channel.slice("chat:user:".length);
			localFanOutUser(userId, parsed.event, parsed.payload);
		}
	} catch {
		// Malformed message — ignore
	}
});

function send(ws: ChatSocket, payload: unknown) {
	// A throw from a half-closed socket must not abort a fan-out loop mid-broadcast,
	// which would silently drop the event for every later recipient.
	try {
		ws.send(JSON.stringify(payload));
	} catch (err) {
		logger.warn({ err }, "chat-hub: failed to send to socket");
	}
}

function getOrCreateSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
	const existing = map.get(key);
	if (existing) return existing;
	const next = new Set<V>();
	map.set(key, next);
	return next;
}

function localFanOutConversation(
	conversationId: string,
	event: string,
	payload: Record<string, unknown>,
	excludeUserId?: string
) {
	const sockets = conversationSockets.get(conversationId);
	if (!sockets) return;
	for (const ws of sockets) {
		const meta = socketMeta.get(ws);
		if (!meta) continue;
		if (excludeUserId && meta.userId === excludeUserId) continue;
		send(ws, { type: event, conversationId, ...payload });
	}
}

function localFanOutUser(userId: string, event: string, payload: Record<string, unknown>) {
	const sockets = userSockets.get(userId);
	if (!sockets) return;
	for (const ws of sockets) {
		send(ws, { type: event, ...payload });
	}
}

async function redisPublishConversation(
	conversationId: string,
	event: string,
	payload: Record<string, unknown>,
	excludeUserId?: string
) {
	try {
		await redis.publish(
			`chat:conv:${conversationId}`,
			JSON.stringify({ event, payload, excludeUserId })
		);
	} catch (err) {
		logger.warn({ err }, "chat-hub: failed to publish conversation event to Redis");
	}
}

async function redisPublishUser(userId: string, event: string, payload: Record<string, unknown>) {
	try {
		await redis.publish(`chat:user:${userId}`, JSON.stringify({ event, payload }));
	} catch (err) {
		logger.warn({ err }, "chat-hub: failed to publish user event to Redis");
	}
}

function notifySessionInvalidation(ws: ChatSocket, reason: RealtimeSessionInvalidationReason) {
	send(ws, { type: "chat:session-invalidated", reason });
	try {
		ws.close?.(4401, reason);
	} catch {
		// Ignore close failures from stale sockets.
	}
}

export function registerChatSocket(
	ws: ChatSocket,
	userId: string,
	sessionId: string
): { firstConnection: boolean } {
	const existingUserSockets = userSockets.get(userId);
	const firstConnection = !existingUserSockets || existingUserSockets.size === 0;

	socketMeta.set(ws, { sessionId, userId, subscriptions: new Set() });
	getOrCreateSet(sessionSockets, sessionId).add(ws);
	getOrCreateSet(userSockets, userId).add(ws);
	send(ws, { type: "chat:connected", userId });
	void setUserOnline(userId);

	return { firstConnection };
}

export function unregisterChatSocket(ws: ChatSocket): { lastConnection: boolean } {
	const meta = socketMeta.get(ws);
	if (!meta) return { lastConnection: false };

	for (const conversationId of meta.subscriptions) {
		const sockets = conversationSockets.get(conversationId);
		if (!sockets) continue;
		sockets.delete(ws);
		if (sockets.size === 0) conversationSockets.delete(conversationId);
	}

	const socketsForSession = sessionSockets.get(meta.sessionId);
	if (socketsForSession) {
		socketsForSession.delete(ws);
		if (socketsForSession.size === 0) {
			sessionSockets.delete(meta.sessionId);
		}
	}

	let lastConnection = false;
	const socketsForUser = userSockets.get(meta.userId);
	if (socketsForUser) {
		socketsForUser.delete(ws);
		if (socketsForUser.size === 0) {
			userSockets.delete(meta.userId);
			// Only mark offline when no remaining sockets for this user
			void setUserOffline(meta.userId);
			lastConnection = true;
		}
	}

	socketMeta.delete(ws);
	return { lastConnection };
}

export function disconnectChatSession(
	sessionId: string,
	reason: RealtimeSessionInvalidationReason
) {
	const sockets = sessionSockets.get(sessionId);
	if (!sockets || sockets.size === 0) return;

	for (const ws of [...sockets]) {
		notifySessionInvalidation(ws, reason);
		unregisterChatSocket(ws);
	}
}

export function disconnectChatUserSessions(
	userId: string,
	reason: RealtimeSessionInvalidationReason
) {
	const sockets = userSockets.get(userId);
	if (!sockets || sockets.size === 0) return;

	for (const ws of [...sockets]) {
		notifySessionInvalidation(ws, reason);
		unregisterChatSocket(ws);
	}
}

export function subscribeSocketToConversation(ws: ChatSocket, conversationId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	meta.subscriptions.add(conversationId);
	getOrCreateSet(conversationSockets, conversationId).add(ws);

	// Subscribe this process to the Redis channel if not already subscribed
	void redisSubscriber.subscribe(`chat:conv:${conversationId}`).catch((err: Error) => {
		logger.warn({ err, conversationId }, "chat-hub: failed to subscribe to Redis channel");
	});

	send(ws, { type: "conversation:subscribed", conversationId });
}

export function unsubscribeSocketFromConversation(ws: ChatSocket, conversationId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	meta.subscriptions.delete(conversationId);

	const sockets = conversationSockets.get(conversationId);
	if (sockets) {
		sockets.delete(ws);
		if (sockets.size === 0) {
			conversationSockets.delete(conversationId);
			// No local subscribers left — unsubscribe from Redis channel
			void redisSubscriber.unsubscribe(`chat:conv:${conversationId}`).catch((err: Error) => {
				logger.warn({ err, conversationId }, "chat-hub: failed to unsubscribe from Redis channel");
			});
		}
	}

	send(ws, { type: "conversation:unsubscribed", conversationId });
}

export function publishConversationEvent(params: {
	conversationId: string;
	event: string;
	payload: Record<string, unknown>;
	excludeUserId?: string;
}) {
	// Local fan-out (fast path — same process)
	localFanOutConversation(
		params.conversationId,
		params.event,
		params.payload,
		params.excludeUserId
	);
	// Cross-process fan-out via Redis
	void redisPublishConversation(
		params.conversationId,
		params.event,
		params.payload,
		params.excludeUserId
	);
}

export function publishUserEvent(params: {
	userId: string;
	event: string;
	payload: Record<string, unknown>;
}) {
	localFanOutUser(params.userId, params.event, params.payload);
	void redisPublishUser(params.userId, params.event, params.payload);
}

export function publishUsersEvent(params: {
	userIds: string[];
	event: string;
	payload: Record<string, unknown>;
}) {
	for (const userId of params.userIds) {
		publishUserEvent({ userId, event: params.event, payload: params.payload });
	}
}

/**
 * Tell a user's chat sockets that they lost access to the given conversations.
 * The client removes them from the list and unsubscribes; server-side membership
 * is the source of truth, so this is a live-UX signal (it self-corrects on the
 * next list fetch).
 */
export function revokeChatConversationsForUser(userId: string, conversationIds: string[]) {
	if (conversationIds.length === 0) return;
	localFanOutUser(userId, "conversation:access-revoked", { conversationIds });
	void redisPublishUser(userId, "conversation:access-revoked", { conversationIds });
}

export function refreshSocketPresence(ws: ChatSocket) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	void refreshPresence(meta.userId);
}

/**
 * Whether the user currently has a socket subscribed to (i.e. is viewing) the
 * conversation on this process. Used to suppress message notifications for
 * members who are already in the room.
 */
export function isUserSubscribedToConversation(conversationId: string, userId: string): boolean {
	const sockets = conversationSockets.get(conversationId);
	if (!sockets) return false;
	for (const ws of sockets) {
		if (socketMeta.get(ws)?.userId === userId) return true;
	}
	return false;
}
