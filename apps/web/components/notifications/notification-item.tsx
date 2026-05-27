"use client";

import { Cancel01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import React from "react";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";
import type { NotificationSummary } from "@/lib/data/notifications";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function getNotificationHref(notification: NotificationSummary): string | null {
	if (notification.destinationHref) return notification.destinationHref;

	const { referenceType, referenceId } = notification;

	switch (referenceType) {
		case "recruitment_listing":
			return appRoutes.recruiting.root;
		case "recruitment_application":
			return appRoutes.recruiting.conversations;
		case "team_invite":
			return referenceId ? appRoutes.teams.roster(referenceId) : null;
		case "org_invite":
			return referenceId ? appRoutes.orgs.byId(referenceId) : null;
		default:
			// Security notification types have no referenceType; route by notification.type
			if (
				notification.type === "new_device_login" ||
				notification.type === "session_revoked_alert" ||
				notification.type === "new_location_login" ||
				notification.type === "email_change_requested"
			) {
				return appRoutes.settings.security;
			}
			if (notification.type === "account_deletion_requested") {
				return appRoutes.settings.account;
			}
			return null;
	}
}

interface NotificationItemProps {
	notification: NotificationSummary;
	onMarkRead?: (notificationId: string) => Promise<void> | void;
	onMarkUnread?: (notificationId: string) => Promise<void> | void;
	onDismiss?: (notificationId: string) => Promise<void> | void;
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
	isPending: externalPending,
}: NotificationItemProps) {
	const relativeTime = useRelativeTime(notification.createdAt);
	const { submit, isPending } = useFormAction(markNotificationReadAction, {});
	const isBusy = externalPending ?? (!onMarkRead && isPending);
	const href = getNotificationHref(notification);

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

			{href ? (
				<Link
					href={href}
					className="min-w-0 flex-1"
					onClick={() => {
						if (!notification.isRead && onMarkRead) {
							void onMarkRead(notification.id);
						}
					}}
				>
					<p className="text-sm font-medium">{notification.title}</p>
					{notification.body && (
						<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
					)}
					<p className="mt-1 text-[10px] text-muted-foreground">{relativeTime}</p>
				</Link>
			) : (
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium">{notification.title}</p>
					{notification.body && (
						<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
					)}
					<p className="mt-1 text-[10px] text-muted-foreground">{relativeTime}</p>
				</div>
			)}

			{!notification.isRead && (
				<Button
					size="sm"
					variant="ghost"
					className="h-7 shrink-0 text-xs text-muted-foreground"
					onClick={markRead}
					disabled={isBusy}
				>
					Mark read
				</Button>
			)}

			{notification.isRead && onMarkUnread && (
				<Button
					size="sm"
					variant="ghost"
					className="h-7 shrink-0 text-xs text-muted-foreground"
					onClick={() => void onMarkUnread(notification.id)}
					disabled={isBusy}
				>
					Mark unread
				</Button>
			)}

			{onDismiss && (
				<Button
					size="icon"
					variant="ghost"
					className="size-6 shrink-0 text-muted-foreground"
					onClick={() => void onDismiss(notification.id)}
					disabled={isBusy}
				>
					<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
				</Button>
			)}
		</div>
	);
}
