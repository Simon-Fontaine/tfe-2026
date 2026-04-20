"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
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
				default:
					break;
			}
		});

		return () => {
			removeListener();
		};
	}, []);

	return null;
}
