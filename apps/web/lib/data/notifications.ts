import type { NotificationSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type { NotificationSummary };

export const getNotificationsForUser = cache(
	async (
		_userId: string,
		cursor?: string
	): Promise<{ notifications: NotificationSummary[]; nextCursor: string | null }> => {
		const url = cursor
			? `${apiRoutes.notifications.root}?cursor=${encodeURIComponent(cursor)}&limit=20`
			: `${apiRoutes.notifications.root}?limit=20`;
		const res = await apiGet<NotificationSummary[]>(url);
		if ("data" in res) {
			const paginated = res as unknown as {
				data: NotificationSummary[];
				nextCursor: string | null;
			};
			return { notifications: paginated.data, nextCursor: paginated.nextCursor ?? null };
		}
		throw new Error(res.error);
	}
);

export const getUnreadNotificationCount = cache(async (_userId: string): Promise<number> => {
	const res = await apiGet<{ count: number }>(apiRoutes.notifications.unreadCount);
	if ("data" in res) return res.data.count;
	return 0;
});
