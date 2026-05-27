import type { NotificationSummary } from "@scrimflow/shared";
import { create } from "zustand";

function sortNotifications(notifications: NotificationSummary[]) {
	return [...notifications].sort((left, right) => {
		return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
	});
}

function mergeNotifications(
	current: NotificationSummary[],
	incoming: NotificationSummary[]
): NotificationSummary[] {
	const byId = new Map(current.map((notification) => [notification.id, notification]));

	for (const notification of incoming) {
		const existing = byId.get(notification.id);
		byId.set(
			notification.id,
			existing
				? {
						...notification,
						...existing,
						isRead: existing.isRead || notification.isRead,
						isDismissed: notification.isDismissed,
					}
				: notification
		);
	}

	return sortNotifications([...byId.values()]);
}

interface InboxState {
	notifications: NotificationSummary[];
	unreadCount: number | null;
}

interface InboxActions {
	hydrateUnreadCount(unreadCount: number): void;
	hydrateNotifications(notifications: NotificationSummary[]): void;
	prependNotification(notification: NotificationSummary, unreadCount: number): void;
	markNotificationRead(notificationId: string, unreadCount: number): void;
	markAllNotificationsRead(unreadCount: number): void;
	markNotificationUnread(notificationId: string, unreadCount: number): void;
	dismissNotification(notificationId: string, unreadCount: number): void;
	restoreNotification(notificationId: string): void;
}

export const useInboxStore = create<InboxState & InboxActions>((set) => ({
	notifications: [],
	unreadCount: null,

	hydrateUnreadCount(unreadCount) {
		set({ unreadCount });
	},

	hydrateNotifications(notifications) {
		set((state) => ({
			notifications: mergeNotifications(state.notifications, notifications),
		}));
	},

	prependNotification(notification, unreadCount) {
		set((state) => ({
			notifications: sortNotifications([
				notification,
				...state.notifications.filter((item) => item.id !== notification.id),
			]),
			unreadCount,
		}));
	},

	markNotificationRead(notificationId, unreadCount) {
		set((state) => ({
			notifications: state.notifications.map((notification) =>
				notification.id === notificationId
					? {
							...notification,
							isRead: true,
						}
					: notification
			),
			unreadCount,
		}));
	},

	markAllNotificationsRead(unreadCount) {
		set((state) => ({
			notifications: state.notifications.map((notification) => ({
				...notification,
				isRead: true,
			})),
			unreadCount,
		}));
	},

	markNotificationUnread(notificationId, unreadCount) {
		set((state) => ({
			notifications: state.notifications.map((notification) =>
				notification.id === notificationId ? { ...notification, isRead: false } : notification
			),
			unreadCount,
		}));
	},

	dismissNotification(notificationId, unreadCount) {
		set((state) => ({
			notifications: state.notifications.map((notification) =>
				notification.id === notificationId ? { ...notification, isDismissed: true } : notification
			),
			unreadCount,
		}));
	},

	restoreNotification(notificationId) {
		set((state) => ({
			notifications: state.notifications.map((notification) =>
				notification.id === notificationId ? { ...notification, isDismissed: false } : notification
			),
		}));
	},
}));
