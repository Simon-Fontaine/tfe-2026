"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { NotificationSummary } from "@scrimflow/shared";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { apiRoutes } from "@/lib/routes";
import { useInboxStore } from "@/stores/inbox";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationItem } from "./notification-item";

async function readApiError(response: Response): Promise<string | null> {
	const payload = await response.json().catch(() => null);
	if (!payload || typeof payload !== "object") return null;
	return "error" in payload && typeof payload.error === "string" ? payload.error : null;
}

interface InboxPageClientProps {
	initialNotifications: NotificationSummary[];
	initialUnreadCount: number;
}

export function InboxPageClient({
	initialNotifications,
	initialUnreadCount,
}: InboxPageClientProps) {
	const notifications = useInboxStore((state) => state.notifications);
	const unreadCount = useInboxStore((state) => state.unreadCount);
	const hydrateNotifications = useInboxStore((state) => state.hydrateNotifications);
	const markNotificationRead = useInboxStore((state) => state.markNotificationRead);
	const markAllNotificationsRead = useInboxStore((state) => state.markAllNotificationsRead);
	const [pendingNotificationIds, setPendingNotificationIds] = useState<string[]>([]);
	const [isMarkAllPending, setIsMarkAllPending] = useState(false);

	useEffect(() => {
		hydrateNotifications(initialNotifications);
	}, [hydrateNotifications, initialNotifications]);

	const displayUnreadCount = unreadCount ?? initialUnreadCount;
	const displayNotifications = useMemo(() => {
		if (notifications.length === 0) return initialNotifications;
		return notifications;
	}, [initialNotifications, notifications]);

	async function handleMarkRead(notificationId: string) {
		if (pendingNotificationIds.includes(notificationId)) return;

		setPendingNotificationIds((current) => [...current, notificationId]);
		try {
			const response = await fetch(apiRoutes.notifications.read(notificationId), {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				toast.error((await readApiError(response)) ?? "Unable to mark notification as read.");
				return;
			}

			const store = useInboxStore.getState();
			const currentNotification =
				store.notifications.find((notification) => notification.id === notificationId) ??
				initialNotifications.find((notification) => notification.id === notificationId) ??
				null;
			const currentUnreadCount = store.unreadCount ?? initialUnreadCount;
			const nextUnreadCount = currentNotification?.isRead
				? currentUnreadCount
				: Math.max(currentUnreadCount - 1, 0);

			markNotificationRead(notificationId, nextUnreadCount);
		} catch {
			toast.error("Unable to reach the API server.");
		} finally {
			setPendingNotificationIds((current) => current.filter((id) => id !== notificationId));
		}
	}

	async function handleMarkAllRead() {
		if (isMarkAllPending) return;

		setIsMarkAllPending(true);
		try {
			const response = await fetch(apiRoutes.notifications.readAll, {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				toast.error((await readApiError(response)) ?? "Unable to mark notifications as read.");
				return;
			}

			markAllNotificationsRead(0);
		} catch {
			toast.error("Unable to reach the API server.");
		} finally {
			setIsMarkAllPending(false);
		}
	}

	return (
		<PageContainer>
			<PageHeader
				title="Inbox"
				description={
					displayUnreadCount > 0
						? `${displayUnreadCount} unread item${displayUnreadCount === 1 ? "" : "s"}`
						: "All caught up"
				}
				actions={
					displayUnreadCount > 0 ? (
						<MarkAllReadButton onClick={handleMarkAllRead} isPending={isMarkAllPending} />
					) : undefined
				}
			/>

			{displayNotifications.length === 0 ? (
				<EmptyStateBlock
					icon={Notification01Icon}
					title="No notifications yet"
					description="Scrim requests, chat activity, and team updates will appear here in realtime."
					variant="card"
				/>
			) : (
				<div className="border">
					{displayNotifications.map((notification) => (
						<NotificationItem
							key={notification.id}
							notification={notification}
							onMarkRead={handleMarkRead}
							isPending={pendingNotificationIds.includes(notification.id)}
						/>
					))}
				</div>
			)}
		</PageContainer>
	);
}
