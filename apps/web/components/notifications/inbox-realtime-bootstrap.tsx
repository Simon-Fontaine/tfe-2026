"use client";

import type { RealtimeEvent } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useEffect } from "react";
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
		const removeListener = realtimeSocket.addListener((event: RealtimeEvent) => {
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
				default:
					break;
			}
		});

		return () => {
			removeListener();
		};
	}, []);

	// Re-sync whenever the socket reconnects so events missed during a disconnect
	// (new notifications, read/dismiss state) don't leave the inbox stale. We
	// refresh both the unread badge and the list — the store merge preserves any
	// local read/dismissed state.
	useEffect(() => {
		let prevConnected: boolean | null = null;

		const removeConnectionListener = realtimeSocket.addConnectionListener(
			async (connected: boolean) => {
				const isReconnect = prevConnected === false && connected;
				prevConnected = connected;

				if (!isReconnect) return;

				const store = useInboxStore.getState();

				try {
					const [countRes, listRes] = await Promise.all([
						fetch(apiRoutes.notifications.unreadCount, { credentials: "include" }),
						fetch(apiRoutes.notifications.root, { credentials: "include" }),
					]);

					if (countRes.ok) {
						const countData = (await countRes.json()) as { data: { count: number } };
						store.hydrateUnreadCount(countData.data.count);
					}
					if (listRes.ok) {
						const listData = (await listRes.json()) as {
							data: Parameters<typeof store.hydrateNotifications>[0];
						};
						store.hydrateNotifications(listData.data);
					}
				} catch {
					// fail silently — stale inbox is preferable to a broken shell
				}
			}
		);

		return () => {
			removeConnectionListener();
		};
	}, []);

	return null;
}
