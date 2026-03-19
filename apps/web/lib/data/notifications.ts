import { desc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { notificationTable } from "@/db/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationSummary = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	referenceType: string | null;
	referenceId: string | null;
	isRead: boolean;
	createdAt: Date;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the most recent notifications for a user.
 * Memoized per request.
 */
export const getNotificationsForUser = cache(
	async (userId: string, limit = 30): Promise<NotificationSummary[]> => {
		const rows = await db.query.notificationTable.findMany({
			where: eq(notificationTable.userId, userId),
			orderBy: [desc(notificationTable.createdAt)],
			limit,
		});

		return rows.map((r) => ({
			id: r.id,
			type: r.type,
			title: r.title,
			body: r.body ?? null,
			referenceType: r.referenceType ?? null,
			referenceId: r.referenceId ?? null,
			isRead: r.isRead,
			createdAt: r.createdAt,
		}));
	}
);

/**
 * Returns the count of unread notifications for a user.
 * Memoized per request — used for the sidebar bell badge.
 */
export const getUnreadNotificationCount = cache(async (userId: string): Promise<number> => {
	const rows = await db.query.notificationTable.findMany({
		where: eq(notificationTable.userId, userId),
		columns: { isRead: true },
	});
	return rows.filter((r) => !r.isRead).length;
});
