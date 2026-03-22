import { Hono } from "hono";
import { optionalAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const sessionRoutes = new Hono<RequestContextEnv>();

sessionRoutes.use("*", optionalAuth);

// GET / — Return current session + user (or nulls if unauthenticated)
sessionRoutes.get("/", (c) => {
	const session = c.get("session") ?? null;
	const user = c.get("user") ?? null;
	return c.json({ data: { session, user } });
});

export { sessionRoutes as authSessionRoutes };
