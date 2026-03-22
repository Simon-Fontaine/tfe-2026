import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const securityRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET /summary — Check if user has a password set (for security settings page)
securityRoutes.get("/summary", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ passwordHash: userTable.passwordHash })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return c.json({ data: { hasPassword: !!row?.passwordHash } });
});

export { securityRoutes };
