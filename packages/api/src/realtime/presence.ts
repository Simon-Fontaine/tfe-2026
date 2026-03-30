import type { UserPresence, UserPresenceStatus } from "@scrimflow/shared";
import type Redis from "ioredis";
import logger from "@/utils/logger";

/**
 * Redis TTL-based presence tracking.
 * Key: presence:{userId} → JSON-encoded UserPresence
 * TTL: 65 seconds. Clients send a heartbeat every 30s to refresh.
 * On disconnect the key expires naturally and the user becomes "offline".
 */

const PRESENCE_TTL_SECONDS = 65;
const PRESENCE_KEY_PREFIX = "presence:";

function key(userId: string) {
	return `${PRESENCE_KEY_PREFIX}${userId}`;
}

function getRedis(): Redis | null {
	const url = process.env.REDIS_URL;
	if (!url) return null;
	// Reuse the singleton created by the main redis module where possible.
	// Imported lazily to avoid circular imports.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require("@/db/redis").default as Redis | null;
}

function encodePresence(status: UserPresenceStatus, lastSeenAt: Date | null): string {
	return JSON.stringify({
		status,
		lastSeenAt: lastSeenAt?.toISOString() ?? null,
	});
}

function decodePresence(userId: string, raw: string | null): UserPresence {
	if (!raw) {
		return { userId, status: "offline", lastSeenAt: null };
	}
	try {
		const parsed = JSON.parse(raw) as { status: UserPresenceStatus; lastSeenAt: string | null };
		return { userId, status: parsed.status ?? "offline", lastSeenAt: parsed.lastSeenAt };
	} catch {
		return { userId, status: "offline", lastSeenAt: null };
	}
}

export async function setUserOnline(userId: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;
	try {
		await redis.setex(key(userId), PRESENCE_TTL_SECONDS, encodePresence("online", null));
	} catch (err) {
		logger.warn({ err, userId }, "presence: failed to set online");
	}
}

export async function setUserOffline(userId: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;
	try {
		const lastSeenAt = new Date();
		// Store offline presence with lastSeenAt for a short window (5 min)
		await redis.setex(key(userId), 300, encodePresence("offline", lastSeenAt));
	} catch (err) {
		logger.warn({ err, userId }, "presence: failed to set offline");
	}
}

export async function refreshPresence(userId: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;
	try {
		const existing = await redis.get(key(userId));
		if (!existing) {
			// Socket is alive but key expired — re-set to online
			await redis.setex(key(userId), PRESENCE_TTL_SECONDS, encodePresence("online", null));
			return;
		}
		// Refresh TTL without changing status
		await redis.expire(key(userId), PRESENCE_TTL_SECONDS);
	} catch (err) {
		logger.warn({ err, userId }, "presence: failed to refresh");
	}
}

export async function getUserPresence(userId: string): Promise<UserPresence> {
	const redis = getRedis();
	if (!redis) return { userId, status: "offline", lastSeenAt: null };
	try {
		const raw = await redis.get(key(userId));
		return decodePresence(userId, raw);
	} catch (err) {
		logger.warn({ err, userId }, "presence: failed to get");
		return { userId, status: "offline", lastSeenAt: null };
	}
}

export async function getUsersPresence(userIds: string[]): Promise<UserPresence[]> {
	if (userIds.length === 0) return [];
	const redis = getRedis();
	if (!redis) return userIds.map((userId) => ({ userId, status: "offline", lastSeenAt: null }));
	try {
		const keys = userIds.map(key);
		const values = await redis.mget(...keys);
		return userIds.map((userId, i) => decodePresence(userId, values[i] ?? null));
	} catch (err) {
		logger.warn({ err }, "presence: failed to get multiple");
		return userIds.map((userId) => ({ userId, status: "offline", lastSeenAt: null }));
	}
}
