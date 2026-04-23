import { InboxPageClient } from "@/components/notifications/inbox-page-client";
import { getNotificationsForUser } from "@/lib/data/notifications";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function InboxPage() {
	const { user } = await requireWorkspaceSession();

	const notifications = await getNotificationsForUser(user.id);
	const unreadCount = notifications.filter((notification) => !notification.isRead).length;

	return <InboxPageClient initialNotifications={notifications} initialUnreadCount={unreadCount} />;
}
