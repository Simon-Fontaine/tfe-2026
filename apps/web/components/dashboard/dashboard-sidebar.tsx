"use client";

import {
	ArrowUpDownIcon,
	BubbleChatIcon,
	Home01Icon,
	Settings01Icon,
	Sword03Icon,
	UserAdd01Icon,
	UserGroupIcon,
	UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
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
import { ContextSwitcher, type SwitcherOrg, type SwitcherTeam } from "./context-switcher";

const COMING_SOON_LINKS = [{ label: "Chat", icon: BubbleChatIcon, href: "/dashboard/chat" }];

interface DashboardSidebarProps {
	user: SessionUser;
	unreadCount: number;
	contextOrgs: SwitcherOrg[];
	contextTeams: SwitcherTeam[];
}

function useActiveContext(pathname: string) {
	const teamMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)\/team\/([^/]+)/);
	const orgMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)/);
	return {
		activeOrgId: orgMatch?.[1] ?? null,
		activeTeamId: teamMatch?.[2] ?? null,
	};
}

export function DashboardSidebar({
	user,
	unreadCount,
	contextOrgs,
	contextTeams,
}: DashboardSidebarProps) {
	const pathname = usePathname();
	const initials = getUserInitials(user.displayName);
	const { activeOrgId, activeTeamId } = useActiveContext(pathname);

	const contextGroups =
		activeTeamId && activeOrgId
			? [
					{
						label: "Team",
						links: [
							{
								label: "Overview",
								href: `/dashboard/c/org/${activeOrgId}/team/${activeTeamId}`,
								icon: Home01Icon,
								exact: true,
							},
							{
								label: "Players",
								href: `/dashboard/c/org/${activeOrgId}/team/${activeTeamId}/players`,
								icon: UserGroupIcon,
							},
							{
								label: "Staff",
								href: `/dashboard/c/org/${activeOrgId}/team/${activeTeamId}/staff`,
								icon: UserAdd01Icon,
							},
							{
								label: "Posts",
								href: `/dashboard/c/org/${activeOrgId}/team/${activeTeamId}/posts`,
								icon: UserSearch01Icon,
							},
							{
								label: "Settings",
								href: `/dashboard/c/org/${activeOrgId}/team/${activeTeamId}/settings`,
								icon: Settings01Icon,
							},
						],
					},
					{
						label: "Organization",
						links: [
							{
								label: "Back to org",
								href: `/dashboard/c/org/${activeOrgId}`,
								icon: UserGroupIcon,
							},
						],
					},
				]
			: activeOrgId
				? [
						{
							label: "Organization",
							links: [
								{
									label: "Overview",
									href: `/dashboard/c/org/${activeOrgId}`,
									icon: Home01Icon,
									exact: true,
								},
								{
									label: "Teams",
									href: `/dashboard/c/org/${activeOrgId}/teams`,
									icon: Sword03Icon,
								},
								{
									label: "Members",
									href: `/dashboard/c/org/${activeOrgId}/members`,
									icon: UserGroupIcon,
								},
								{
									label: "Posts",
									href: `/dashboard/c/org/${activeOrgId}/posts`,
									icon: UserSearch01Icon,
								},
								{
									label: "Settings",
									href: `/dashboard/c/org/${activeOrgId}/settings`,
									icon: Settings01Icon,
								},
							],
						},
					]
				: siteConfig.nav.dashboard;

	return (
		<Sidebar collapsible="icon">
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
					<SidebarMenuItem>
						<ContextSwitcher orgs={contextOrgs} teams={contextTeams} />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{contextGroups.map((group, i) => (
					<SidebarGroup key={group.label ?? i}>
						{group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
						<SidebarGroupContent>
							<SidebarMenu>
								{group.links.map((link) => {
									const isExact = "exact" in link && link.exact;
									const isActive = isExact
										? pathname === link.href
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
				))}

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

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="px-2 py-1">
							<NotificationBell unreadCount={unreadCount} />
						</div>
					</SidebarMenuItem>
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
								<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
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
