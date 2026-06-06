import { rateLimits } from "@scrimflow/shared";
import { createMiddleware } from "hono/factory";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";

/**
 * IP-keyed rate limiter for unauthenticated public read endpoints (heroes, public
 * orgs/teams/players/listings/stats/updates). These run without `requireAuth`, so an
 * abusive client could otherwise scrape them unthrottled. Keyed by the request IP from
 * the global request-context middleware; requests without an IP are not limited.
 */
export const publicRateLimit = createMiddleware<RequestContextEnv>(async (c, next) => {
	const ip = c.get("client")?.ip;
	if (ip) {
		const { allowed, retryAfterMs } = await checkRateLimit(
			`public-read:${ip}`,
			rateLimits.publicRead.limit,
			rateLimits.publicRead.windowMs
		);
		if (!allowed) {
			return c.json(
				{
					error: `Too many requests. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
				},
				429
			);
		}
	}
	await next();
});
