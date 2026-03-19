import Redis from "ioredis";
import logger from "./logger";

/**
 * Singleton Redis client, preserving connection across dev reloads.
 * Exports null when unconfigured for in-memory fallbacks.
 */

declare global {
	var __redis: Redis | null | undefined;
}

function createClient(): Redis | null {
	const url = process.env.REDIS_URL;
	if (!url) return null;

	const client = new Redis(url, {
		// Prevent slow Redis stalling
		commandTimeout: 500,
		// Reconnect transient failures
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
		lazyConnect: false,
	});

	client.on("error", (err: Error) => {
		// Log without throwing for fallbacks
		logger.error({ err }, "redis connection error");
	});

	return client;
}

const redis: Redis | null =
	process.env.NODE_ENV === "production" ? createClient() : (globalThis.__redis ?? createClient());

if (process.env.NODE_ENV === "development") {
	globalThis.__redis = redis;
}

export default redis;
