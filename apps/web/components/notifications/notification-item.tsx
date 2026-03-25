"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { markNotificationReadAction } from "@/app/dashboard/actions/notifications";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";
import type { NotificationSummary } from "@/lib/data/notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
	notification: NotificationSummary;
}

function formatRelativeTime(iso: string): string {
	const date = new Date(iso);
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString();
}

export function NotificationItem({ notification }: NotificationItemProps) {
	const { submit, isPending } = useFormAction(markNotificationReadAction, {});

	function markRead() {
		const fd = new FormData();
		fd.set("notificationId", notification.id);
		submit(fd);
	}

	return (
		<div
			className={cn(
				"flex items-start gap-3 border-b px-1 py-3 last:border-b-0",
				!notification.isRead && "bg-muted/30"
			)}
		>
			<div
				className={cn(
					"mt-0.5 flex size-7 shrink-0 items-center justify-center",
					notification.isRead ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
				)}
			>
				<HugeiconsIcon icon={Notification01Icon} strokeWidth={2} className="size-3.5" />
			</div>

			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium">{notification.title}</p>
				{notification.body && (
					<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
				)}
				<p className="mt-1 text-[10px] text-muted-foreground">
					{formatRelativeTime(notification.createdAt)}
				</p>
			</div>

			{!notification.isRead && (
				<Button
					size="sm"
					variant="ghost"
					className="h-7 shrink-0 text-xs text-muted-foreground"
					onClick={markRead}
					disabled={isPending}
				>
					Mark read
				</Button>
			)}
		</div>
	);
}
