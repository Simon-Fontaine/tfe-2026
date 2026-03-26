import { Notification01Icon } from "@hugeicons/core-free-icons";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationItem } from "@/components/notifications/notification-item";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotificationsForUser } from "@/lib/data/notifications";

export default async function NotificationsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const notifications = await getNotificationsForUser(user.id);
	const unreadCount = notifications.filter((n) => !n.isRead).length;

	return (
		<PageContainer>
			<PageHeader
				title="Notifications"
				description={
					unreadCount > 0
						? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
						: "All caught up"
				}
				actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
			/>

			{notifications.length === 0 ? (
				<EmptyStateBlock
					icon={Notification01Icon}
					title="No notifications yet"
					description="Activity from teams, invites, and scrims will appear here."
					variant="card"
				/>
			) : (
				<div className="border">
					{notifications.map((notification) => (
						<NotificationItem key={notification.id} notification={notification} />
					))}
				</div>
			)}
		</PageContainer>
	);
}
