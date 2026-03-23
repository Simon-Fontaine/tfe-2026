import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { notificationTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";

const notificationRoutes = new Hono<AuthEnv>();

// GET / — List user's notifications
notificationRoutes.get("/", async (c) => {
	const user = c.get("user");

	const rows = await db.query.notificationTable.findMany({
		where: eq(notificationTable.userId, user.id),
		orderBy: [desc(notificationTable.createdAt)],
		limit: 30,
	});

	return c.json({
		data: rows.map((r) => ({
			id: r.id,
			type: r.type,
			title: r.title,
			body: r.body ?? null,
			referenceType: r.referenceType ?? null,
			referenceId: r.referenceId ?? null,
			isRead: r.isRead,
			createdAt: r.createdAt,
		})),
	});
});

// GET /unread-count — Count unread notifications
notificationRoutes.get("/unread-count", async (c) => {
	const user = c.get("user");

	const rows = await db.query.notificationTable.findMany({
		where: eq(notificationTable.userId, user.id),
		columns: { isRead: true },
	});

	return c.json({ data: { count: rows.filter((r) => !r.isRead).length } });
});

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
