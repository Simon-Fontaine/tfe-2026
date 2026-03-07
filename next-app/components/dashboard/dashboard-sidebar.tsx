"use client";

import {
	ArrowUpDownIcon,
	BubbleChatIcon,
	GameController01Icon,
	Search01Icon,
	Sword03Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUserInitials, UserMenuDropdown } from "@/components/shared/user-menu-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";

const COMING_SOON_LINKS = [
	{ label: "Teams", icon: UserGroupIcon, href: "/dashboard/teams" },
	{ label: "Scrims", icon: GameController01Icon, href: "/dashboard/scrims" },
	{ label: "LFG", icon: Search01Icon, href: "/dashboard/lfg" },
	{ label: "Chat", icon: BubbleChatIcon, href: "/dashboard/chat" },
];

interface DashboardSidebarProps {
	user: SessionUser;
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
	const pathname = usePathname();
	const initials = getUserInitials(user.displayName);

	return (
		<Sidebar collapsible="icon">
			{/* ── Header: link back to home ─────────────────────── */}
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild tooltip="Scrimflow home">
							<Link href="/">
								<div className="flex size-8 items-center justify-center border bg-primary/10">
									<HugeiconsIcon
										icon={Sword03Icon}
										strokeWidth={2}
										className="size-4 text-primary"
									/>
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Scrimflow</span>
									<span className="truncate text-xs text-muted-foreground">Overwatch 2</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			{/* ── Content: nav links ────────────────────────────── */}
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{siteConfig.nav.dashboard.map((link) => {
								const isActive =
									link.href === "/dashboard"
										? pathname === "/dashboard"
										: pathname.startsWith(link.href);
								return (
									<SidebarMenuItem key={link.href}>
										<SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
											<Link href={link.href}>
												<HugeiconsIcon icon={link.icon} strokeWidth={2} />
												{link.label}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<SidebarGroupLabel>Coming soon</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{COMING_SOON_LINKS.map((link) => (
								<SidebarMenuItem key={link.href}>
									<SidebarMenuButton
										disabled
										className="cursor-default opacity-40"
										tooltip={link.label}
									>
										<HugeiconsIcon icon={link.icon} strokeWidth={2} />
										<span>{link.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			{/* ── Footer: user menu ─────────────────────────────── */}
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<UserMenuDropdown
							user={user}
							contentClassName="w-[--radix-dropdown-menu-trigger-width] min-w-56"
							side="bottom"
							align="end"
							sideOffset={4}
						>
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								tooltip={user.displayName}
							>
								<Avatar className="size-8 shrink-0 rounded-none overflow-hidden after:rounded-none">
									<AvatarImage className="rounded-none" src={user.avatarUrl ?? undefined} />
									<AvatarFallback className="rounded-none text-xs">{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-xs leading-tight">
									<span className="truncate font-semibold">{user.displayName}</span>
									<span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
								</div>
								<HugeiconsIcon icon={ArrowUpDownIcon} strokeWidth={2} className="ml-auto" />
							</SidebarMenuButton>
						</UserMenuDropdown>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
