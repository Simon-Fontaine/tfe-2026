import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

interface NotificationBellProps {
	unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
	return (
		<Link
			href="/dashboard/me/notifications"
			className="relative inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		>
			<HugeiconsIcon icon={Notification01Icon} strokeWidth={2} className="size-4" />
			{unreadCount > 0 && (
				<span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold leading-none text-primary-foreground">
					{unreadCount > 9 ? "9+" : unreadCount}
				</span>
			)}
		</Link>
	);
}
