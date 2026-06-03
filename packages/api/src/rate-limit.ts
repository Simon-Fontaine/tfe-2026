import redis from "@/db/redis";

/** Redis-backed rate limiter. */

export interface RateLimitResult {
	allowed: boolean;
	/** Milliseconds until the rate-limit window resets (0 when allowed). */
	retryAfterMs: number;
}

// Atomically increments the counter and ensures the key always has a TTL.
// Handles orphaned keys (TTL = -1) left by prior non-atomic paths.
const LUA_RATE_LIMIT = `
local key = KEYS[1]
local windowTtl = tonumber(ARGV[1])
local count = redis.call('INCR', key)
local ttl = redis.call('TTL', key)
if ttl < 0 then
  redis.call('EXPIRE', key, windowTtl)
  ttl = windowTtl
end
return {count, ttl}
`;

async function redisCheck(id: string, limit: number, windowMs: number): Promise<RateLimitResult> {
	const key = `rl:${id}`;
	const ttlSeconds = Math.ceil(windowMs / 1000);

	const result = (await redis.eval(LUA_RATE_LIMIT, 1, key, ttlSeconds)) as [number, number];
	const [count, ttl] = result;

	if (count <= limit) {
		return { allowed: true, retryAfterMs: 0 };
	}

	return { allowed: false, retryAfterMs: Math.max(0, ttl * 1000) };
}

async function redisReset(id: string): Promise<void> {
	await redis.del(`rl:${id}`);
}

/** Formats a millisecond duration into a human-readable string. */
export function formatRetryAfter(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""}`;
	const minutes = Math.ceil(totalSeconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
	const hours = Math.round(minutes / 60);
	return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

export async function checkRateLimit(
	id: string,
	limit: number,
	windowMs: number
): Promise<RateLimitResult> {
	return redisCheck(id, limit, windowMs);
}

export async function resetRateLimit(id: string): Promise<void> {
	await redisReset(id);
}
