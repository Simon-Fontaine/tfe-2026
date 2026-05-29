import { createMiddleware } from "hono/factory";
import type { AuthEnv } from "@/middleware/auth";

export const EXEMPT_PATHS = new Set(["/api/users/me", "/api/moderation/my-status"]);

export const requireActiveAccount = createMiddleware<AuthEnv>(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	if ((user.requiresReverification || user.isBanned) && !EXEMPT_PATHS.has(c.req.path)) {
		return c.json({ error: "Account restricted" }, 403);
	}
	await next();
});
