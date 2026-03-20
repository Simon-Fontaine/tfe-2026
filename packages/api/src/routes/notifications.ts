import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { notificationTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";

const notificationRoutes = new Hono<AuthEnv>();

// POST /:id/read — Mark notification read
notificationRoutes.post("/:id/read", async (c) => {
	const user = c.get("user");
	const notificationId = c.req.param("id");

	await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(and(eq(notificationTable.id, notificationId), eq(notificationTable.userId, user.id)));

	return c.json({ success: true });
});

// POST /read-all — Mark all notifications read
notificationRoutes.post("/read-all", async (c) => {
	const user = c.get("user");

	await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(eq(notificationTable.userId, user.id));

	return c.json({ success: true });
});

export { notificationRoutes };
