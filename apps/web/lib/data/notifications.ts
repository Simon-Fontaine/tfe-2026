import type { NotificationSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type { NotificationSummary };

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getNotificationsForUser = cache(
	async (_userId: string, _limit = 30): Promise<NotificationSummary[]> => {
		const res = await apiGet<NotificationSummary[]>("/api/notifications");
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getUnreadNotificationCount = cache(async (_userId: string): Promise<number> => {
	const res = await apiGet<{ count: number }>("/api/notifications/unread-count");
	if ("data" in res) return res.data.count;
	return 0;
});
