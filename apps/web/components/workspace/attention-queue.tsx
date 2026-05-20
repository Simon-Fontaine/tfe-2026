import {
	AlertCircleIcon,
	ArrowRight01Icon,
	Calendar03Icon,
	Mail01Icon,
	Notification01Icon,
	UserGroupIcon,
	UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export type AttentionQueueItem = {
	id: string;
	title: string;
	objectType: string;
	contextLabel: string;
	statusText: string;
	timestamp: string | null;
	priority: number;
	sortDirection?: "asc" | "desc";
	actionLabel: string;
	href: string;
	permissionCopy?: string;
	icon?: IconSvgElement;
};

interface AttentionQueueProps {
	items: AttentionQueueItem[];
	className?: string;
}

function formatQueueTime(value: string | null) {
	if (!value) return "No date";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "No date";
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function defaultIcon(type: string) {
	if (type.includes("invite")) return Mail01Icon;
	if (type.includes("scrim")) return Calendar03Icon;
	if (type.includes("application")) return UserSearch01Icon;
	if (type.includes("notification")) return Notification01Icon;
	if (type.includes("org") || type.includes("team")) return UserGroupIcon;
	return AlertCircleIcon;
}

export function AttentionQueue({ items, className }: AttentionQueueProps) {
	const sortedItems = [...items].sort((a, b) => {
		if (a.priority !== b.priority) return a.priority - b.priority;
		const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
		const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
		const sortDirection = a.sortDirection ?? b.sortDirection ?? "desc";
		if (sortDirection === "asc") return aTime - bTime;
		return bTime - aTime;
	});

	if (sortedItems.length === 0) {
		return (
			<Card className={className}>
				<CardContent className="pt-6">
					<Empty>
						<EmptyHeader>
							<EmptyTitle>Nothing needs attention</EmptyTitle>
							<EmptyDescription>
								New invites, scrims, recruiting decisions, and workflow notifications will appear
								here when there is something to act on.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("space-y-2", className)}>
			{sortedItems.map((item) => {
				const icon = item.icon ?? defaultIcon(item.objectType);
				return (
					<Card key={item.id}>
						<CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
							<div className="flex min-w-0 gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center bg-muted">
									<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
								</div>
								<div className="min-w-0 space-y-1">
									<div className="flex min-w-0 flex-wrap items-center gap-2">
										<p className="min-w-0 truncate text-sm font-semibold">{item.title}</p>
										<Badge variant="secondary" className="shrink-0 text-[10px]">
											{item.statusText}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										{item.contextLabel} · {item.objectType} · {formatQueueTime(item.timestamp)}
									</p>
									{item.permissionCopy ? (
										<p className="text-xs text-muted-foreground">{item.permissionCopy}</p>
									) : null}
								</div>
							</div>
							<Button
								asChild
								size="sm"
								variant="outline"
								className="justify-self-start sm:justify-self-end"
							>
								<Link href={item.href}>
									{item.actionLabel}
									<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
								</Link>
							</Button>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
