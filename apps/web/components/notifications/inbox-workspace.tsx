"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { NotificationSummary } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { useInboxStore } from "@/stores/inbox";
import { type InboxFilter, InboxFilterBar } from "./inbox-filter-bar";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationDetailPane } from "./notification-detail-pane";
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

interface InboxWorkspaceProps {
	initialNotifications: NotificationSummary[];
	initialUnreadCount: number;
	initialNextCursor: string | null;
}

export function InboxWorkspace({
	initialNotifications,
	initialUnreadCount,
	initialNextCursor,
}: InboxWorkspaceProps) {
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
	const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
	const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

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

	const selectedNotification = useMemo(
		() => displayNotifications.find((n) => n.id === selectedNotificationId) ?? null,
		[displayNotifications, selectedNotificationId]
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

			if (selectedNotificationId === notificationId) {
				setSelectedNotificationId(null);
			}
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

	function handleSelect(notificationId: string) {
		setSelectedNotificationId(notificationId);
		const notification =
			useInboxStore.getState().notifications.find((n) => n.id === notificationId) ??
			initialNotifications.find((n) => n.id === notificationId) ??
			null;
		if (notification && !notification.isRead) {
			void handleMarkRead(notificationId);
		}
	}

	async function handleLoadMore() {
		if (!nextCursor || isLoadingMore) return;
		setIsLoadingMore(true);
		try {
			const url = `${apiRoutes.notifications.root}?cursor=${encodeURIComponent(nextCursor)}&limit=20`;
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) return;
			const payload = (await res.json()) as {
				data: NotificationSummary[];
				nextCursor: string | null;
			};
			hydrateNotifications(payload.data);
			setNextCursor(payload.nextCursor ?? null);
		} catch {
			// fail silently — existing notifications remain visible
		} finally {
			setIsLoadingMore(false);
		}
	}

	return (
		<div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
			{/* Left panel: thread list */}
			<div className="flex flex-col overflow-hidden border-r">
				<div className="flex items-start justify-between border-b p-4">
					<h1 className="text-2xl font-semibold">Inbox</h1>
					{displayUnreadCount > 0 && (
						<MarkAllReadButton onClick={handleMarkAllRead} isPending={isMarkAllPending} />
					)}
				</div>
				<div className="border-b p-3">
					<InboxFilterBar activeFilter={filter} onFilterChange={setFilter} />
				</div>
				<div className="flex-1 overflow-y-auto">
					{filteredNotifications.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No notifications yet.
						</div>
					) : (
						<>
							{filteredNotifications.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onMarkRead={handleMarkRead}
									onMarkUnread={handleMarkUnread}
									onDismiss={handleDismiss}
									onSelect={() => handleSelect(notification.id)}
									isSelected={selectedNotificationId === notification.id}
									isPending={pendingNotificationIds.includes(notification.id)}
								/>
							))}
							{nextCursor && (
								<div className="flex justify-center pt-4">
									<Button
										variant="outline"
										size="sm"
										onClick={handleLoadMore}
										disabled={isLoadingMore}
									>
										{isLoadingMore ? "Loading…" : "Load more"}
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* Right panel: detail */}
			<div
				className={
					selectedNotification
						? "flex flex-col overflow-y-auto"
						: "flex items-center justify-center"
				}
			>
				{selectedNotification ? (
					<NotificationDetailPane notification={selectedNotification} />
				) : (
					<EmptyState icon={Notification01Icon} title="No messages yet." />
				)}
			</div>
		</div>
	);
}
