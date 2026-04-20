import type { RealtimeSessionInvalidationReason } from "@scrimflow/shared";
import Redis from "ioredis";
import logger from "@/utils/logger";
import { refreshPresence, setUserOffline, setUserOnline } from "./presence";

/**
 * Chat pub/sub hub.
 *
 * Architecture:
 * - In-memory Maps provide fast local fan-out within a single process.
 * - Redis pub/sub bridges events across multiple API processes.
 *   Channels: `chat:conv:{conversationId}` and `chat:user:{userId}`
 * - Falls back to in-memory-only when Redis is unavailable.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatSocket = {
	send: (payload: string) => unknown;
	close?: (code?: number, reason?: string) => unknown;
};

type SocketMeta = {
	sessionId: string;
	userId: string;
	subscriptions: Set<string>;
};

// ─── In-memory state ─────────────────────────────────────────────────────────

const socketMeta = new Map<ChatSocket, SocketMeta>();
const sessionSockets = new Map<string, Set<ChatSocket>>();
const userSockets = new Map<string, Set<ChatSocket>>();
const conversationSockets = new Map<string, Set<ChatSocket>>();

// ─── Redis pub/sub ────────────────────────────────────────────────────────────

function createRedisSubscriber(): Redis | null {
	const url = process.env.REDIS_URL;
	if (!url) return null;
	const client = new Redis(url, {
		commandTimeout: 500,
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
		lazyConnect: false,
	});
	client.on("error", (err: Error) => {
		logger.error({ err }, "chat-hub redis subscriber error");
	});
	return client;
}

function getRedisPublisher(): Redis | null {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return (require("@/db/redis").default as Redis | null) ?? null;
}

// Dedicated subscriber connection (cannot share with publisher)
const redisSubscriber = createRedisSubscriber();

if (redisSubscriber) {
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(ws: ChatSocket, payload: unknown) {
	ws.send(JSON.stringify(payload));
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
	const publisher = getRedisPublisher();
	if (!publisher) return;
	try {
		await publisher.publish(
			`chat:conv:${conversationId}`,
			JSON.stringify({ event, payload, excludeUserId })
		);
	} catch (err) {
		logger.warn({ err }, "chat-hub: failed to publish conversation event to Redis");
	}
}

async function redisPublishUser(userId: string, event: string, payload: Record<string, unknown>) {
	const publisher = getRedisPublisher();
	if (!publisher) return;
	try {
		await publisher.publish(`chat:user:${userId}`, JSON.stringify({ event, payload }));
	} catch (err) {
		logger.warn({ err }, "chat-hub: failed to publish user event to Redis");
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

function notifySessionInvalidation(ws: ChatSocket, reason: RealtimeSessionInvalidationReason) {
	send(ws, { type: "chat:session-invalidated", reason });
	try {
		ws.close?.(4401, reason);
	} catch {
		// Ignore close failures from stale sockets.
	}
}

export function registerChatSocket(ws: ChatSocket, userId: string, sessionId: string) {
	socketMeta.set(ws, { sessionId, userId, subscriptions: new Set() });
	getOrCreateSet(sessionSockets, sessionId).add(ws);
	getOrCreateSet(userSockets, userId).add(ws);
	send(ws, { type: "chat:connected", userId });
	void setUserOnline(userId);
}

export function unregisterChatSocket(ws: ChatSocket) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

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

	const socketsForUser = userSockets.get(meta.userId);
	if (socketsForUser) {
		socketsForUser.delete(ws);
		if (socketsForUser.size === 0) {
			userSockets.delete(meta.userId);
			// Only mark offline when no remaining sockets for this user
			void setUserOffline(meta.userId);
		}
	}

	socketMeta.delete(ws);
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
	if (redisSubscriber) {
		void redisSubscriber.subscribe(`chat:conv:${conversationId}`).catch((err: Error) => {
			logger.warn({ err, conversationId }, "chat-hub: failed to subscribe to Redis channel");
		});
	}

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
			if (redisSubscriber) {
				void redisSubscriber.unsubscribe(`chat:conv:${conversationId}`).catch((err: Error) => {
					logger.warn(
						{ err, conversationId },
						"chat-hub: failed to unsubscribe from Redis channel"
					);
				});
			}
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

export function refreshSocketPresence(ws: ChatSocket) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	void refreshPresence(meta.userId);
}
