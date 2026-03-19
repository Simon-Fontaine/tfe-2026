import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";

import { invalidateSession } from "@/auth/session";
import { type AuthEnv, requireAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const logoutRoutes = new Hono<RequestContextEnv & AuthEnv>();

logoutRoutes.use("*", requireAuth);

logoutRoutes.post("/", async (c) => {
	const session = c.get("session");

	await invalidateSession(session.id);

	deleteCookie(c, "session_token");

	return c.json({ success: true });
});

export { logoutRoutes };
