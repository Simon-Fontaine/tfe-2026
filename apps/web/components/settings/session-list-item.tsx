"use client";

import { ComputerIcon, GlobeIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SessionInfo } from "@/app/dashboard/settings/actions/session";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SessionListItemProps {
	session: SessionInfo;
	onRevoke: (id: string) => void;
	revoking: boolean;
}

function parseDevice(ua: string | null) {
	if (!ua) return { name: "Unknown device", isMobile: false };
	const isMobile = /mobile|android|iphone|ipad/i.test(ua);

	const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Brave)[/\s]?([\d.]+)?/i);
	const osMatch = ua.match(/(Windows|Mac OS X|Linux|Android|iOS|iPhone OS)[/\s]?([\d._]+)?/i);

	const browser = browserMatch?.[1] ?? "Unknown browser";
	const os = osMatch?.[1]?.replace(/_/g, ".") ?? "Unknown OS";

	return { name: `${browser} on ${os}`, isMobile };
}

function relativeTime(iso: string) {
	const diff = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function SessionListItem({ session, onRevoke, revoking }: SessionListItemProps) {
	const device = parseDevice(session.userAgent);
	const icon = device.isMobile ? SmartPhone01Icon : ComputerIcon;
	const location = [session.geoCity, session.geoCountry].filter(Boolean).join(", ");

	return (
		<div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
			<HugeiconsIcon
				icon={icon}
				strokeWidth={2}
				className="size-5 shrink-0 text-muted-foreground"
			/>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="truncate text-xs font-medium">{device.name}</span>
					{session.isCurrent && (
						<Badge variant="secondary" className="text-xs">
							Current
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{location && (
						<span className="flex items-center gap-1">
							<HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-3" />
							{location}
						</span>
					)}
					<span>Active {relativeTime(session.lastActiveAt)}</span>
				</div>
			</div>
			{!session.isCurrent && (
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline" size="sm" disabled={revoking} className="text-destructive">
							Revoke
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Revoke this session?</AlertDialogTitle>
							<AlertDialogDescription>
								This will immediately sign out the {device.name} session
								{location ? ` from ${location}` : ""}. The device will need to sign in again.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={() => onRevoke(session.id)} disabled={revoking}>
								Revoke session
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}
