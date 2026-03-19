"use client";

import {
	ComputerIcon,
	DashboardSquare01Icon,
	Logout01Icon,
	Moon02Icon,
	Settings01Icon,
	Sun02Icon,
	Tick01Icon,
	UserCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { signOutAction } from "@/app/(auth)/auth/sign-out-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UserMenuUser {
	displayName: string;
	email: string;
	avatarUrl: string | null;
}

export function getUserInitials(displayName: string) {
	return displayName
		.split(" ")
		.map((w) => w[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

interface UserMenuDropdownProps {
	user: UserMenuUser;
	/** The trigger element — rendered inside DropdownMenuTrigger asChild */
	children: React.ReactNode;
	/** Extra classes on the dropdown content panel */
	contentClassName?: string;
	align?: "start" | "center" | "end";
	side?: "top" | "right" | "bottom" | "left";
	sideOffset?: number;
}

export function UserMenuDropdown({
	user,
	children,
	contentClassName,
	align = "end",
	side = "bottom",
	sideOffset = 4,
}: UserMenuDropdownProps) {
	const { theme, setTheme } = useTheme();
	const [isPending, startTransition] = useTransition();
	const initials = getUserInitials(user.displayName);

	function handleSignOut() {
		startTransition(async () => {
			try {
				await signOutAction();
			} catch (error) {
				if (
					typeof error === "object" &&
					error !== null &&
					"digest" in error &&
					typeof (error as { digest: unknown }).digest === "string" &&
					(error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
				) {
					return;
				}
				throw error;
			}
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>

			<DropdownMenuContent
				align={align}
				side={side}
				sideOffset={sideOffset}
				className={contentClassName ?? "min-w-56"}
			>
				{/* User info */}
				<DropdownMenuLabel className="p-0 font-normal">
					<div className="flex items-center gap-2 px-2 py-2">
						<Avatar className="size-7 shrink-0 rounded-none overflow-hidden after:rounded-none">
							<AvatarImage className="rounded-none" src={user.avatarUrl ?? undefined} />
							<AvatarFallback className="rounded-none text-xs">{initials}</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 leading-tight">
							<span className="truncate text-xs font-semibold">{user.displayName}</span>
							<span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
						</div>
					</div>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/dashboard">
							<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
							Dashboard
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/profile">
							<HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
							Profile
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/settings">
							<HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
							Settings
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				{/* Theme */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<HugeiconsIcon icon={Sun02Icon} strokeWidth={2} />
						Theme
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<DropdownMenuItem onClick={() => setTheme("light")}>
								<HugeiconsIcon icon={Sun02Icon} strokeWidth={2} />
								Light
								{theme === "light" && (
									<HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="ml-auto" />
								)}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTheme("dark")}>
								<HugeiconsIcon icon={Moon02Icon} strokeWidth={2} />
								Dark
								{theme === "dark" && (
									<HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="ml-auto" />
								)}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTheme("system")}>
								<HugeiconsIcon icon={ComputerIcon} strokeWidth={2} />
								System
								{theme === "system" && (
									<HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="ml-auto" />
								)}
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>

				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={handleSignOut} disabled={isPending} variant="destructive">
					<HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
