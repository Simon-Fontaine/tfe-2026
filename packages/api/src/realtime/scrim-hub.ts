import Redis from "ioredis";
import logger from "@/utils/logger";

type RealtimeSocket = {
	send: (payload: string) => unknown;
};

type SocketMeta = {
	userId: string;
	scrimSubscriptions: Set<string>;
	teamSubscriptions: Set<string>;
};

const socketMeta = new Map<RealtimeSocket, SocketMeta>();
const userSockets = new Map<string, Set<RealtimeSocket>>();
const scrimSockets = new Map<string, Set<RealtimeSocket>>();
const teamSockets = new Map<string, Set<RealtimeSocket>>();

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
		logger.error({ err }, "scrim-hub redis subscriber error");
	});
	return client;
}

function getRedisPublisher(): Redis | null {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return (require("@/db/redis").default as Redis | null) ?? null;
}

const redisSubscriber = createRedisSubscriber();

function send(ws: RealtimeSocket, payload: unknown) {
	ws.send(JSON.stringify(payload));
}

function getOrCreateSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
	const existing = map.get(key);
	if (existing) return existing;
	const next = new Set<V>();
	map.set(key, next);
	return next;
}

function localFanOutScrim(scrimId: string, event: string, payload: Record<string, unknown>) {
	const sockets = scrimSockets.get(scrimId);
	if (!sockets) return;
	for (const ws of sockets) {
		send(ws, { type: event, scrimId, ...payload });
	}
}

function localFanOutTeam(teamId: string, event: string, payload: Record<string, unknown>) {
	const sockets = teamSockets.get(teamId);
	if (!sockets) return;
	for (const ws of sockets) {
		send(ws, { type: event, teamId, ...payload });
	}
}

function localFanOutUser(userId: string, event: string, payload: Record<string, unknown>) {
	const sockets = userSockets.get(userId);
	if (!sockets) return;
	for (const ws of sockets) {
		send(ws, { type: event, ...payload });
	}
}

async function redisPublishScrim(scrimId: string, event: string, payload: Record<string, unknown>) {
	const publisher = getRedisPublisher();
	if (!publisher) return;
	try {
		await publisher.publish(`realtime:scrim:${scrimId}`, JSON.stringify({ event, payload }));
	} catch (err) {
		logger.warn({ err }, "scrim-hub: failed to publish scrim event to Redis");
	}
}

async function redisPublishTeam(teamId: string, event: string, payload: Record<string, unknown>) {
	const publisher = getRedisPublisher();
	if (!publisher) return;
	try {
		await publisher.publish(`realtime:team:${teamId}`, JSON.stringify({ event, payload }));
	} catch (err) {
		logger.warn({ err }, "scrim-hub: failed to publish team event to Redis");
	}
}

async function redisPublishUser(userId: string, event: string, payload: Record<string, unknown>) {
	const publisher = getRedisPublisher();
	if (!publisher) return;
	try {
		await publisher.publish(`realtime:user:${userId}`, JSON.stringify({ event, payload }));
	} catch (err) {
		logger.warn({ err }, "scrim-hub: failed to publish user event to Redis");
	}
}

if (redisSubscriber) {
	redisSubscriber.on("message", (channel: string, message: string) => {
		try {
			const parsed = JSON.parse(message) as {
				event: string;
				payload: Record<string, unknown>;
			};

			if (channel.startsWith("realtime:scrim:")) {
				const scrimId = channel.slice("realtime:scrim:".length);
				localFanOutScrim(scrimId, parsed.event, parsed.payload);
				return;
			}

			if (channel.startsWith("realtime:team:")) {
				const teamId = channel.slice("realtime:team:".length);
				localFanOutTeam(teamId, parsed.event, parsed.payload);
				return;
			}

			if (channel.startsWith("realtime:user:")) {
				const userId = channel.slice("realtime:user:".length);
				localFanOutUser(userId, parsed.event, parsed.payload);
			}
		} catch {
			// Ignore malformed payloads.
		}
	});
}

export function registerRealtimeSocket(ws: RealtimeSocket, userId: string) {
	socketMeta.set(ws, { userId, scrimSubscriptions: new Set(), teamSubscriptions: new Set() });
	getOrCreateSet(userSockets, userId).add(ws);
	send(ws, { type: "realtime:connected", userId });
}

export function unregisterRealtimeSocket(ws: RealtimeSocket) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	for (const scrimId of meta.scrimSubscriptions) {
		const sockets = scrimSockets.get(scrimId);
		if (!sockets) continue;
		sockets.delete(ws);
		if (sockets.size === 0) {
			scrimSockets.delete(scrimId);
			if (redisSubscriber) {
				void redisSubscriber.unsubscribe(`realtime:scrim:${scrimId}`).catch((err: Error) => {
					logger.warn({ err, scrimId }, "scrim-hub: failed to unsubscribe from Redis channel");
				});
			}
		}
	}

	for (const teamId of meta.teamSubscriptions) {
		const sockets = teamSockets.get(teamId);
		if (!sockets) continue;
		sockets.delete(ws);
		if (sockets.size === 0) {
			teamSockets.delete(teamId);
			if (redisSubscriber) {
				void redisSubscriber.unsubscribe(`realtime:team:${teamId}`).catch((err: Error) => {
					logger.warn({ err, teamId }, "scrim-hub: failed to unsubscribe from team Redis channel");
				});
			}
		}
	}

	const socketsForUser = userSockets.get(meta.userId);
	if (socketsForUser) {
		socketsForUser.delete(ws);
		if (socketsForUser.size === 0) {
			userSockets.delete(meta.userId);
		}
	}

	socketMeta.delete(ws);
}

export function subscribeSocketToScrim(ws: RealtimeSocket, scrimId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	meta.scrimSubscriptions.add(scrimId);
	getOrCreateSet(scrimSockets, scrimId).add(ws);

	if (redisSubscriber) {
		void redisSubscriber.subscribe(`realtime:scrim:${scrimId}`).catch((err: Error) => {
			logger.warn({ err, scrimId }, "scrim-hub: failed to subscribe to Redis channel");
		});
	}

	send(ws, { type: "scrim:subscribed", scrimId });
}

export function subscribeSocketToTeam(ws: RealtimeSocket, teamId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	meta.teamSubscriptions.add(teamId);
	getOrCreateSet(teamSockets, teamId).add(ws);

	if (redisSubscriber) {
		void redisSubscriber.subscribe(`realtime:team:${teamId}`).catch((err: Error) => {
			logger.warn({ err, teamId }, "scrim-hub: failed to subscribe to team Redis channel");
		});
	}

	send(ws, { type: "team:subscribed", teamId });
}

export function unsubscribeSocketFromScrim(ws: RealtimeSocket, scrimId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	meta.scrimSubscriptions.delete(scrimId);

	const sockets = scrimSockets.get(scrimId);
	if (sockets) {
		sockets.delete(ws);
		if (sockets.size === 0) {
			scrimSockets.delete(scrimId);
			if (redisSubscriber) {
				void redisSubscriber.unsubscribe(`realtime:scrim:${scrimId}`).catch((err: Error) => {
					logger.warn({ err, scrimId }, "scrim-hub: failed to unsubscribe from Redis channel");
				});
			}
		}
	}

	send(ws, { type: "scrim:unsubscribed", scrimId });
}

export function unsubscribeSocketFromTeam(ws: RealtimeSocket, teamId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	meta.teamSubscriptions.delete(teamId);

	const sockets = teamSockets.get(teamId);
	if (sockets) {
		sockets.delete(ws);
		if (sockets.size === 0) {
			teamSockets.delete(teamId);
			if (redisSubscriber) {
				void redisSubscriber.unsubscribe(`realtime:team:${teamId}`).catch((err: Error) => {
					logger.warn({ err, teamId }, "scrim-hub: failed to unsubscribe from team Redis channel");
				});
			}
		}
	}

	send(ws, { type: "team:unsubscribed", teamId });
}

export function publishScrimEvent(params: {
	scrimId: string;
	event: string;
	payload: Record<string, unknown>;
}) {
	localFanOutScrim(params.scrimId, params.event, params.payload);
	void redisPublishScrim(params.scrimId, params.event, params.payload);
}

export function publishTeamEvent(params: {
	teamId: string;
	event: string;
	payload: Record<string, unknown>;
}) {
	localFanOutTeam(params.teamId, params.event, params.payload);
	void redisPublishTeam(params.teamId, params.event, params.payload);
}

export function publishUserRealtimeEvent(params: {
	userId: string;
	event: string;
	payload: Record<string, unknown>;
}) {
	localFanOutUser(params.userId, params.event, params.payload);
	void redisPublishUser(params.userId, params.event, params.payload);
}

export function publishUsersRealtimeEvent(params: {
	userIds: string[];
	event: string;
	payload: Record<string, unknown>;
}) {
	for (const userId of params.userIds) {
		publishUserRealtimeEvent({
			userId,
			event: params.event,
			payload: params.payload,
		});
	}
}
