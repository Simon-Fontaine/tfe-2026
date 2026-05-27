import { InboxErrorBlock, InboxPageClient } from "@/components/notifications/inbox-page-client";
import { getNotificationsForUser } from "@/lib/data/notifications";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

interface InboxPageProps {
	searchParams: Promise<{ cursor?: string }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
	const { user } = await requireWorkspaceSession();
	const { cursor } = await searchParams;

	try {
		const { notifications, nextCursor } = await getNotificationsForUser(user.id, cursor);
		const unreadCount = notifications.filter((notification) => !notification.isRead).length;

		return (
			<InboxPageClient
				initialNotifications={notifications}
				initialUnreadCount={unreadCount}
				nextCursor={nextCursor}
			/>
		);
	} catch {
		return <InboxErrorBlock />;
	}
}
