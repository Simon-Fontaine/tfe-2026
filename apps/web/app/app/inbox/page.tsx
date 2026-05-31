import { InboxErrorBlock } from "@/components/notifications/inbox-page-client";
import { InboxWorkspace } from "@/components/notifications/inbox-workspace";
import { getNotificationsForUser, getUnreadNotificationCount } from "@/lib/data/notifications";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

interface InboxPageProps {
	searchParams: Promise<{ cursor?: string }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
	const { user } = await requireWorkspaceSession();
	const { cursor } = await searchParams;

	try {
		const [{ notifications, nextCursor }, unreadCount] = await Promise.all([
			getNotificationsForUser(user.id, cursor),
			getUnreadNotificationCount(user.id),
		]);

		return (
			<InboxWorkspace
				initialNotifications={notifications}
				initialUnreadCount={unreadCount}
				initialNextCursor={nextCursor}
			/>
		);
	} catch {
		return <InboxErrorBlock />;
	}
}
