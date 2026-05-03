import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { notificationTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { mapNotification } from "@/notifications";
import { publishUserRealtimeEvent } from "@/realtime/scrim-hub";

const notificationRoutes = new Hono<AuthEnv>();

async function getUnreadNotificationCount(userId: string) {
	const [result] = await db
		.select({ count: count() })
		.from(notificationTable)
		.where(and(eq(notificationTable.userId, userId), eq(notificationTable.isRead, false)));

	return Number(result?.count ?? 0);
}

// GET / — List user's notifications
notificationRoutes.get("/", async (c) => {
	const user = c.get("user");

	const rows = await db.query.notificationTable.findMany({
		where: eq(notificationTable.userId, user.id),
		orderBy: [desc(notificationTable.createdAt)],
		limit: 30,
	});

	return c.json({
		data: await Promise.all(rows.map((row) => mapNotification(row, user.id))),
	});
});

// GET /unread-count — Count unread notifications
notificationRoutes.get("/unread-count", async (c) => {
	const user = c.get("user");
	return c.json({ data: { count: await getUnreadNotificationCount(user.id) } });
});

// POST /:id/read — Mark notification read
notificationRoutes.post("/:id/read", async (c) => {
	const user = c.get("user");
	const notificationId = c.req.param("id");
	const notification = await db.query.notificationTable.findFirst({
		where: and(eq(notificationTable.id, notificationId), eq(notificationTable.userId, user.id)),
		columns: {
			id: true,
			isRead: true,
		},
	});
	if (!notification) {
		return c.json({ error: "Notification not found." }, 404);
	}

	if (!notification.isRead) {
		await db
			.update(notificationTable)
			.set({ isRead: true })
			.where(and(eq(notificationTable.id, notificationId), eq(notificationTable.userId, user.id)));

		publishUserRealtimeEvent({
			userId: user.id,
			event: "notification:read",
			payload: {
				notificationId,
				unreadCount: await getUnreadNotificationCount(user.id),
			},
		});
	}

	return c.json({ success: true });
});

// POST /read-all — Mark all notifications read
notificationRoutes.post("/read-all", async (c) => {
	const user = c.get("user");

	await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(eq(notificationTable.userId, user.id));

	publishUserRealtimeEvent({
		userId: user.id,
		event: "notification:read-all",
		payload: {
			unreadCount: 0,
		},
	});

	return c.json({ success: true });
});

export { notificationRoutes };
