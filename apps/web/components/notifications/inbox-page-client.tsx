"use client";

import { Alert01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import type { NotificationSummary } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { apiRoutes } from "@/lib/routes";
import { useInboxStore } from "@/stores/inbox";
import { type InboxFilter, InboxFilterBar } from "./inbox-filter-bar";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationItem } from "./notification-item";

const SECURITY_TYPES = new Set([
	"new_device_login",
	"new_location_login",
	"email_change_requested",
	"account_deletion_requested",
	"session_revoked_alert",
]);

function matchesFilter(notification: NotificationSummary, filter: InboxFilter): boolean {
	if (filter.unreadOnly && notification.isRead) return false;

	if (filter.category === "all") return true;

	const { referenceType, type } = notification;

	switch (filter.category) {
		case "scrim":
			return referenceType === "scrim";
		case "team":
			return referenceType === "team_invite";
		case "recruiting":
			return referenceType === "recruitment_application" || referenceType === "recruitment_listing";
		case "chat":
			return referenceType === "chat_channel";
		case "security":
			return SECURITY_TYPES.has(type);
		default:
			return true;
	}
}

async function readApiError(response: Response): Promise<string | null> {
	const payload = await response.json().catch(() => null);
	if (!payload || typeof payload !== "object") return null;
	return "error" in payload && typeof payload.error === "string" ? payload.error : null;
}

export function InboxErrorBlock() {
	const router = useRouter();
	return (
		<PageContainer>
			<EmptyStateBlock
				icon={Alert01Icon}
				title="Unable to load inbox"
				description="Something went wrong while loading your notifications."
				variant="card"
				actionLabel="Retry"
				onAction={() => router.refresh()}
			/>
		</PageContainer>
	);
}

interface InboxPageClientProps {
	initialNotifications: NotificationSummary[];
	initialUnreadCount: number;
	nextCursor: string | null;
}

export function InboxPageClient({
	initialNotifications,
	initialUnreadCount,
	nextCursor,
}: InboxPageClientProps) {
	const notifications = useInboxStore((state) => state.notifications);
	const unreadCount = useInboxStore((state) => state.unreadCount);
	const hydrateNotifications = useInboxStore((state) => state.hydrateNotifications);
	const markNotificationRead = useInboxStore((state) => state.markNotificationRead);
	const markAllNotificationsRead = useInboxStore((state) => state.markAllNotificationsRead);
	const markNotificationUnread = useInboxStore((state) => state.markNotificationUnread);
	const dismissNotification = useInboxStore((state) => state.dismissNotification);
	const [pendingNotificationIds, setPendingNotificationIds] = useState<string[]>([]);
	const [isMarkAllPending, setIsMarkAllPending] = useState(false);
	const [filter, setFilter] = useState<InboxFilter>({ unreadOnly: false, category: "all" });

	useEffect(() => {
		hydrateNotifications(initialNotifications);
	}, [hydrateNotifications, initialNotifications]);

	const displayUnreadCount = unreadCount ?? initialUnreadCount;
	const displayNotifications = useMemo(() => {
		const base = notifications.length === 0 ? initialNotifications : notifications;
		return base.filter((n) => !n.isDismissed);
	}, [initialNotifications, notifications]);

	const filteredNotifications = useMemo(
		() => displayNotifications.filter((n) => matchesFilter(n, filter)),
		[displayNotifications, filter]
	);

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

	async function handleMarkUnread(notificationId: string) {
		if (pendingNotificationIds.includes(notificationId)) return;

		setPendingNotificationIds((current) => [...current, notificationId]);
		try {
			const response = await fetch(apiRoutes.notifications.unread(notificationId), {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				toast.error((await readApiError(response)) ?? "Unable to mark notification as unread.");
				return;
			}

			const store = useInboxStore.getState();
			const currentNotification =
				store.notifications.find((notification) => notification.id === notificationId) ??
				initialNotifications.find((notification) => notification.id === notificationId) ??
				null;
			const currentUnreadCount = store.unreadCount ?? initialUnreadCount;
			if (!currentNotification?.isRead) return;
			markNotificationUnread(notificationId, currentUnreadCount + 1);
		} catch {
			toast.error("Unable to reach the API server.");
		} finally {
			setPendingNotificationIds((current) => current.filter((id) => id !== notificationId));
		}
	}

	async function handleDismiss(notificationId: string) {
		if (pendingNotificationIds.includes(notificationId)) return;

		setPendingNotificationIds((current) => [...current, notificationId]);
		try {
			const response = await fetch(apiRoutes.notifications.dismiss(notificationId), {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				toast.error((await readApiError(response)) ?? "Unable to dismiss notification.");
				return;
			}

			const store = useInboxStore.getState();
			const currentNotification =
				store.notifications.find((notification) => notification.id === notificationId) ??
				initialNotifications.find((notification) => notification.id === notificationId) ??
				null;
			const currentUnreadCount = store.unreadCount ?? initialUnreadCount;
			const nextUnreadCount =
				currentNotification && !currentNotification.isRead
					? Math.max(currentUnreadCount - 1, 0)
					: currentUnreadCount;

			dismissNotification(notificationId, nextUnreadCount);
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

	const defaultFilter: InboxFilter = { unreadOnly: false, category: "all" };
	const isFilterActive = filter.unreadOnly || filter.category !== "all";

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

			<InboxFilterBar activeFilter={filter} onFilterChange={setFilter} />

			{displayNotifications.length === 0 ? (
				<EmptyStateBlock
					icon={Notification01Icon}
					title="No notifications yet"
					description="Scrim requests, chat activity, and team updates will appear here in realtime."
					variant="card"
				/>
			) : filteredNotifications.length === 0 ? (
				<EmptyStateBlock
					icon={Notification01Icon}
					title="No notifications match"
					description="Try clearing the filter to see all notifications."
					variant="card"
					actionLabel={isFilterActive ? "Clear filter" : undefined}
					onAction={isFilterActive ? () => setFilter(defaultFilter) : undefined}
				/>
			) : (
				<>
					<div className="border">
						{filteredNotifications.map((notification) => (
							<NotificationItem
								key={notification.id}
								notification={notification}
								onMarkRead={handleMarkRead}
								onMarkUnread={handleMarkUnread}
								onDismiss={handleDismiss}
								isPending={pendingNotificationIds.includes(notification.id)}
							/>
						))}
					</div>
					{nextCursor && <LoadMoreButton nextCursor={nextCursor} />}
				</>
			)}
		</PageContainer>
	);
}
