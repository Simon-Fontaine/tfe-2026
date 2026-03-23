import { rateLimits } from "@scrimflow/shared";
import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";

const usernameRoutes = new Hono<AuthEnv>();

// PATCH / — Change username
usernameRoutes.patch("/", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-username:${session.userId}`,
		rateLimits.changeUsername.limit,
		rateLimits.changeUsername.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ username: string }>().catch(() => null);
	if (!body?.username) return c.json({ error: "Username is required." }, 400);

	const trimmed = body.username.trim();
	if (trimmed.toLowerCase() === user.username.toLowerCase()) {
		return c.json({ error: "That is already your username." }, 400);
	}

	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(and(eq(userTable.username, trimmed), ne(userTable.id, session.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) return c.json({ error: "That username is already taken." }, 409);

	await db.update(userTable).set({ username: trimmed }).where(eq(userTable.id, session.userId));

	return c.json({ success: true });
});

export { usernameRoutes };
