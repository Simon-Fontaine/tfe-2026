import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const notificationPreferencesRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET / — return current preferences for the authenticated user
notificationPreferencesRoutes.get("/", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ notificationPreferences: userTable.notificationPreferences })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return c.json({ data: row?.notificationPreferences ?? {} });
});

// PUT / — save updated preferences for the authenticated user
// userId derives exclusively from session — never from request body (ASVS V4)
const NotificationPrefsSchema = v.record(v.string(), v.boolean());

notificationPreferencesRoutes.put("/", async (c) => {
	const session = c.get("session");
	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(NotificationPrefsSchema, body);
	if (!parsed.success) return c.json({ error: "Invalid preferences payload." }, 400);
	await db
		.update(userTable)
		.set({ notificationPreferences: parsed.output })
		.where(eq(userTable.id, session.userId));
	return c.json({ success: true });
});

export { notificationPreferencesRoutes };
