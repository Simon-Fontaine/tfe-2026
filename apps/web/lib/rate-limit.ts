import redis from "@/lib/redis";
import logger from "./logger";

/**
 * Redis-backed rate limiter with permissive Map fallback.
 * Allows non-atomic INCR/EXPIRE race as acceptable trade-off.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitResult {
	allowed: boolean;
	/** Milliseconds until the rate-limit window resets (0 when allowed). */
	retryAfterMs: number;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface Bucket {
	count: number;
	resetAt: number;
}

const memStore = new Map<string, Bucket>();

setInterval(() => {
	const now = Date.now();
	for (const [key, bucket] of memStore) {
		if (now >= bucket.resetAt) memStore.delete(key);
	}
}, 10 * 60_000).unref();

function memCheck(id: string, limit: number, windowMs: number): RateLimitResult {
	const now = Date.now();
	const existing = memStore.get(id);

	if (!existing || now >= existing.resetAt) {
		memStore.set(id, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfterMs: 0 };
	}

	if (existing.count >= limit) {
		return { allowed: false, retryAfterMs: Math.max(0, existing.resetAt - now) };
	}
	existing.count += 1;
	return { allowed: true, retryAfterMs: 0 };
}

function memReset(id: string): void {
	memStore.delete(id);
}

// ─── Redis backend ─────────────────────────────────────────────────────────────

async function redisCheck(
	client: NonNullable<typeof redis>,
	id: string,
	limit: number,
	windowMs: number
): Promise<RateLimitResult> {
	const key = `rl:${id}`;
	const ttl = Math.ceil(windowMs / 1000);

	const count = await client.incr(key);
	if (count === 1) {
		// Set TTL on first hit
		await client.expire(key, ttl);
	}

	if (count <= limit) {
		return { allowed: true, retryAfterMs: 0 };
	}

	// Get remaining TTL to report accurate retry time
	const remaining = await client.ttl(key);
	return { allowed: false, retryAfterMs: remaining > 0 ? remaining * 1000 : windowMs };
}

async function redisReset(client: NonNullable<typeof redis>, id: string): Promise<void> {
	await client.del(`rl:${id}`);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Formats a millisecond duration into a human-readable string. */
export function formatRetryAfter(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""}`;
	const minutes = Math.ceil(totalSeconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
	const hours = Math.round(minutes / 60);
	return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

/**
 * Never throws. Falls back to in-memory on Redis errors.
 */
export async function checkRateLimit(
	id: string,
	limit: number,
	windowMs: number
): Promise<RateLimitResult> {
	if (redis) {
		try {
			return await redisCheck(redis, id, limit, windowMs);
		} catch (err) {
			logger.warn({ err }, "rate-limit redis error, using in-memory fallback");
		}
	}
	return memCheck(id, limit, windowMs);
}

/** Best-effort bucket reset. */
export async function resetRateLimit(id: string): Promise<void> {
	if (redis) {
		try {
			await redisReset(redis, id);
			return;
		} catch (err) {
			logger.warn({ err }, "rate-limit redis reset error");
		}
	}
	memReset(id);
}
