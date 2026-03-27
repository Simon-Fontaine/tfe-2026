"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderActionsProps {
	unreadCount: number;
}

export function HeaderActions({ unreadCount }: HeaderActionsProps) {
	return (
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="icon-sm" asChild>
						<Link href="/dashboard/personal/notifications" className="relative">
							<HugeiconsIcon icon={Notification01Icon} strokeWidth={2} className="size-4" />
							{unreadCount > 0 && (
								<span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold leading-none text-primary-foreground">
									{unreadCount > 9 ? "9+" : unreadCount}
								</span>
							)}
						</Link>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Notifications</TooltipContent>
			</Tooltip>
		</div>
	);
}
