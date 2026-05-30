"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import React from "react";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormAction } from "@/hooks/use-form-action";
import type { NotificationSummary } from "@/lib/data/notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
	notification: NotificationSummary;
	onMarkRead?: (notificationId: string) => Promise<void> | void;
	onMarkUnread?: (notificationId: string) => Promise<void> | void;
	onDismiss?: (notificationId: string) => Promise<void> | void;
	onSelect?: () => void;
	isSelected?: boolean;
	isPending?: boolean;
}

function formatRelativeTime(iso: string, now: number): string {
	const date = new Date(iso);
	const seconds = Math.floor((now - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString();
}

function useRelativeTime(iso: string): string {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		setNow(Date.now());
		const interval = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(interval);
	}, []);
	return formatRelativeTime(iso, now);
}

export function NotificationItem({
	notification,
	onMarkRead,
	onMarkUnread,
	onDismiss,
	onSelect,
	isSelected,
	isPending: externalPending,
}: NotificationItemProps) {
	const relativeTime = useRelativeTime(notification.createdAt);
	const { submit, isPending } = useFormAction(markNotificationReadAction, {});
	const isBusy = externalPending ?? (!onMarkRead && isPending);

	function markRead() {
		if (onMarkRead) {
			void onMarkRead(notification.id);
			return;
		}

		const fd = new FormData();
		fd.set("notificationId", notification.id);
		submit(fd);
	}

	return (
		<div
			className={cn(
				"flex items-start gap-3 border-b px-3 py-3 last:border-b-0 cursor-pointer hover:bg-muted/30",
				!notification.isRead && "bg-muted/20",
				isSelected && "bg-muted/50"
			)}
			role="button"
			tabIndex={0}
			onClick={() => onSelect?.()}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect?.();
				}
			}}
		>
			<div
				className={cn(
					"mt-0.5 size-2 shrink-0",
					notification.isRead ? "bg-transparent" : "bg-primary"
				)}
			/>

			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium line-clamp-1">{notification.title}</p>
				{notification.body && (
					<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{notification.body}</p>
				)}
				<p className="text-[10px] text-muted-foreground mt-1">{relativeTime}</p>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						size="icon"
						variant="ghost"
						className="size-6 shrink-0"
						onClick={(e) => e.stopPropagation()}
						disabled={isBusy}
					>
						<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{!notification.isRead && (
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								markRead();
							}}
						>
							Mark as read
						</DropdownMenuItem>
					)}
					{notification.isRead && onMarkUnread && (
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								void onMarkUnread(notification.id);
							}}
						>
							Mark as unread
						</DropdownMenuItem>
					)}
					{onDismiss && (
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								void onDismiss(notification.id);
							}}
						>
							Dismiss
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
