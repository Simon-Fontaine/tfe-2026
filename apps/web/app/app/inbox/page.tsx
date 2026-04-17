import { InboxPageClient } from "@/components/notifications/inbox-page-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotificationsForUser } from "@/lib/data/notifications";

export default async function InboxPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const notifications = await getNotificationsForUser(user.id);
	const unreadCount = notifications.filter((notification) => !notification.isRead).length;

	return <InboxPageClient initialNotifications={notifications} initialUnreadCount={unreadCount} />;
}
