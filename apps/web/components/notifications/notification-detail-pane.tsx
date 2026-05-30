"use client";

import type { NotificationSummary } from "@scrimflow/shared";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

interface NotificationDetailPaneProps {
	notification: NotificationSummary;
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

export function NotificationDetailPane({ notification }: NotificationDetailPaneProps) {
	const relativeTime = useRelativeTime(notification.createdAt);
	return (
		<div className="p-6 space-y-4">
			<h2 className="text-lg font-semibold">{notification.title}</h2>
			{notification.body && <p className="text-sm text-muted-foreground">{notification.body}</p>}
			<p className="text-xs text-muted-foreground">{relativeTime}</p>
			{notification.destinationHref && (
				<Button asChild variant="outline">
					<Link href={notification.destinationHref}>View →</Link>
				</Button>
			)}
		</div>
	);
}
