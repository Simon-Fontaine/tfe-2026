import type { UserPresence, UserPresenceStatus } from "@scrimflow/shared";
import redis from "@/db/redis";

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
	await redis.setex(key(userId), PRESENCE_TTL_SECONDS, encodePresence("online", null));
}

export async function setUserOffline(userId: string): Promise<void> {
	const lastSeenAt = new Date();
	await redis.setex(key(userId), 300, encodePresence("offline", lastSeenAt));
}

export async function refreshPresence(userId: string): Promise<void> {
	const existing = await redis.get(key(userId));
	if (!existing) {
		await redis.setex(key(userId), PRESENCE_TTL_SECONDS, encodePresence("online", null));
		return;
	}
	await redis.expire(key(userId), PRESENCE_TTL_SECONDS);
}

export async function getUserPresence(userId: string): Promise<UserPresence> {
	const raw = await redis.get(key(userId));
	return decodePresence(userId, raw);
}

export async function getUsersPresence(userIds: string[]): Promise<UserPresence[]> {
	if (userIds.length === 0) return [];
	const keys = userIds.map(key);
	const values = await redis.mget(...keys);
	return userIds.map((userId, i) => decodePresence(userId, values[i] ?? null));
}
