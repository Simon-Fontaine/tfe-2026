import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Session, SessionUser } from "@/auth/session";
import { validateSessionToken } from "@/auth/session";

export type AuthEnv = {
	Variables: {
		session: Session;
		user: SessionUser;
	};
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getCookie(c, "session_token");
	if (!token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const result = await validateSessionToken(token);
	if (!result.session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("session", result.session);
	c.set("user", result.user);
	await next();
});

export const optionalAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getCookie(c, "session_token");
	if (token) {
		const result = await validateSessionToken(token);
		if (result.session) {
			c.set("session", result.session);
			c.set("user", result.user);
		}
	}
	await next();
});
