"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
	getUserInitials,
	UserMenuDropdown,
	type UserMenuUser,
} from "@/components/shared/user-menu-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderActionsProps {
	user: UserMenuUser;
	unreadCount: number;
}

export function HeaderActions({ user, unreadCount }: HeaderActionsProps) {
	const initials = getUserInitials(user.displayName);

	return (
		<div className="flex items-center gap-1">
			{/* Notification bell */}
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

			{/* User menu */}
			<UserMenuDropdown user={user} align="end" side="bottom" sideOffset={8}>
				<Button
					variant="ghost"
					size="icon-sm"
					className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
					aria-label="User menu"
				>
					<Avatar className="size-6 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage className="rounded-none" src={user.avatarUrl ?? undefined} />
						<AvatarFallback className="rounded-none text-[10px]">{initials}</AvatarFallback>
					</Avatar>
				</Button>
			</UserMenuDropdown>
		</div>
	);
}
