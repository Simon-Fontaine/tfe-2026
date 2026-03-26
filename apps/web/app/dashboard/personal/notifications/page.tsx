import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationItem } from "@/components/notifications/notification-item";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotificationsForUser } from "@/lib/data/notifications";

export default async function NotificationsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const notifications = await getNotificationsForUser(user.id);
	const unreadCount = notifications.filter((n) => !n.isRead).length;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Notifications</h1>
					<p className="text-xs text-muted-foreground">
						{unreadCount > 0
							? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
							: "All caught up"}
					</p>
				</div>
				{unreadCount > 0 && <MarkAllReadButton />}
			</div>

			{notifications.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
					<HugeiconsIcon
						icon={Notification01Icon}
						strokeWidth={1.5}
						className="mb-4 size-10 text-muted-foreground/40"
					/>
					<p className="text-sm font-medium">No notifications yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Activity from teams, invites, and scrims will appear here.
					</p>
				</div>
			) : (
				<div className="border">
					{notifications.map((notification) => (
						<NotificationItem key={notification.id} notification={notification} />
					))}
				</div>
			)}
		</div>
	);
}
