import Redis from "ioredis";
import { requiredEnv } from "@/config/env";
import logger from "@/utils/logger";

/**
 * Singleton Redis client, preserving connection across dev reloads.
 */

declare global {
	var __redis: Redis | undefined;
}

function createClient(): Redis {
	const url = requiredEnv("REDIS_URL");

	const client = new Redis(url, {
		// Prevent slow Redis stalling
		commandTimeout: 500,
		// Reconnect transient failures
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
		lazyConnect: false,
	});

	client.on("error", (err: Error) => {
		logger.error({ err }, "redis connection error");
	});

	return client;
}

const redis: Redis =
	process.env.NODE_ENV === "production" ? createClient() : (globalThis.__redis ?? createClient());

if (process.env.NODE_ENV === "development") {
	globalThis.__redis = redis;
}

export default redis;
