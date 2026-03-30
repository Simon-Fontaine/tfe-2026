"use client";

import type { UserPresenceStatus } from "@scrimflow/shared";
import { cn } from "@/lib/utils";

interface PresenceIndicatorProps {
	status: UserPresenceStatus;
	className?: string;
}

const statusStyles: Record<UserPresenceStatus, string> = {
	online: "bg-green-500",
	away: "bg-yellow-400",
	offline: "bg-muted-foreground/40",
};

const statusLabels: Record<UserPresenceStatus, string> = {
	online: "Online",
	away: "Away",
	offline: "Offline",
};

export function PresenceIndicator({ status, className }: PresenceIndicatorProps) {
	return (
		<span
			role="img"
			aria-label={statusLabels[status]}
			title={statusLabels[status]}
			className={cn("inline-block size-2 shrink-0 rounded-full", statusStyles[status], className)}
		/>
	);
}
