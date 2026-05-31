"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
import { useEffect } from "react";
import { apiRoutes } from "@/lib/routes";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { useInboxStore } from "@/stores/inbox";

interface InboxRealtimeBootstrapProps {
	initialUnreadCount: number;
}

export function InboxRealtimeBootstrap({ initialUnreadCount }: InboxRealtimeBootstrapProps) {
	useEffect(() => {
		useInboxStore.getState().hydrateUnreadCount(initialUnreadCount);
	}, [initialUnreadCount]);

	useEffect(() => {
		const removeListener = realtimeSocket.addListener((event: AppRealtimeEvent) => {
			const store = useInboxStore.getState();

			switch (event.type) {
				case "notification:created":
					store.prependNotification(event.notification, event.unreadCount);
					break;
				case "notification:read":
					store.markNotificationRead(event.notificationId, event.unreadCount);
					break;
				case "notification:read-all":
					store.markAllNotificationsRead(event.unreadCount);
					break;
				case "notification:unread":
					store.markNotificationUnread(event.notificationId, event.unreadCount);
					break;
				case "notification:dismissed":
					store.dismissNotification(event.notificationId, event.unreadCount);
					break;
				case "notification:restored":
					store.restoreNotification(event.notificationId, event.unreadCount);
					break;
				default:
					break;
			}
		});

		return () => {
			removeListener();
		};
	}, []);

	// Re-sync unread count whenever the socket reconnects so missed events
	// during a disconnect don't leave the badge stale.
	useEffect(() => {
		let prevConnected: boolean | null = null;

		const removeConnectionListener = realtimeSocket.addConnectionListener(
			async (connected: boolean) => {
				const isReconnect = prevConnected === false && connected;
				prevConnected = connected;

				if (!isReconnect) return;

				try {
					const res = await fetch(apiRoutes.notifications.unreadCount, {
						credentials: "include",
					});
					if (!res.ok) return;
					const data = (await res.json()) as { data: { count: number } };
					useInboxStore.getState().hydrateUnreadCount(data.data.count);
				} catch {
					// fail silently — stale count is preferable to a broken shell
				}
			}
		);

		return () => {
			removeConnectionListener();
		};
	}, []);

	return null;
}
