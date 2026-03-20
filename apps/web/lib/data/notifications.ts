import { cache } from "react";

import { apiGet } from "@/lib/api-client";

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

export const getNotificationsForUser = cache(
	async (_userId: string, _limit = 30): Promise<NotificationSummary[]> => {
		const res = await apiGet<NotificationSummary[]>("/api/notifications");
		if ("data" in res) return res.data;
		return [];
	}
);

export const getUnreadNotificationCount = cache(async (_userId: string): Promise<number> => {
	const res = await apiGet<{ count: number }>("/api/notifications/unread-count");
	if ("data" in res) return res.data.count;
	return 0;
});
