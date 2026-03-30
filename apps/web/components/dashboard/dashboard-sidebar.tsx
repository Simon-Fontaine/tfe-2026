"use client";

import {
	Calendar03Icon,
	Home01Icon,
	Mail01Icon,
	Settings01Icon,
	Sword03Icon,
	UserAdd01Icon,
	UserCircle02Icon,
	UserGroupIcon,
	UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	getUserInitials,
	UserMenuDropdown,
	type UserMenuUser,
} from "@/components/shared/user-menu-dropdown";
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
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import { dashboardRoutes } from "@/lib/routes";
import { ContextSwitcher, type SwitcherOrg, type SwitcherTeam } from "./context-switcher";

interface DashboardSidebarProps {
	user: SessionUser;
	contextOrgs: SwitcherOrg[];
	contextTeams: SwitcherTeam[];
}

function useActiveContext(pathname: string) {
	const teamMatch = pathname.match(/^\/dashboard\/teams\/([^/]+)/);
	const orgMatch = pathname.match(/^\/dashboard\/orgs\/([^/]+)/);
	return {
		activeOrgId: orgMatch?.[1] ?? null,
		activeTeamId: teamMatch?.[1] ?? null,
	};
}

export function DashboardSidebar({ user, contextOrgs, contextTeams }: DashboardSidebarProps) {
	const pathname = usePathname();
	const { activeOrgId, activeTeamId } = useActiveContext(pathname);

	const activeOrg = activeOrgId ? contextOrgs.find((o) => o.id === activeOrgId) : null;
	const activeTeam = activeTeamId ? contextTeams.find((t) => t.id === activeTeamId) : null;
	const canManageOrg = activeOrg?.canManage ?? false;
	const canManageTeam = activeTeam?.canManage ?? false;

	const contextGroups = activeTeamId
		? [
				{
					label: "Team",
					links: [
						{
							label: "Overview",
							href: dashboardRoutes.teams.byId(activeTeamId),
							icon: Home01Icon,
							exact: true,
						},
						{
							label: "Roster",
							href: dashboardRoutes.teams.roster(activeTeamId),
							icon: UserGroupIcon,
						},
						{
							label: "Schedule",
							href: dashboardRoutes.teams.schedule(activeTeamId),
							icon: Calendar03Icon,
						},
						{
							label: "Posts",
							href: dashboardRoutes.teams.recruitingPosts(activeTeamId),
							icon: UserSearch01Icon,
						},
						{
							label: "Conversations",
							href: dashboardRoutes.teams.recruitingConversations(activeTeamId),
							icon: Mail01Icon,
						},
						...(canManageTeam
							? [
									{
										label: "Invites",
										href: dashboardRoutes.teams.invites(activeTeamId),
										icon: UserAdd01Icon,
									},
									{
										label: "Settings",
										href: dashboardRoutes.teams.settings(activeTeamId),
										icon: Settings01Icon,
									},
								]
							: []),
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
								href: dashboardRoutes.orgs.byId(activeOrgId),
								icon: Home01Icon,
								exact: true,
							},
							{ label: "Teams", href: dashboardRoutes.orgs.teams(activeOrgId), icon: Sword03Icon },
							{
								label: "Members",
								href: dashboardRoutes.orgs.members(activeOrgId),
								icon: UserGroupIcon,
							},
							{
								label: "Posts",
								href: dashboardRoutes.orgs.recruitingPosts(activeOrgId),
								icon: UserSearch01Icon,
							},
							{
								label: "Conversations",
								href: dashboardRoutes.orgs.recruitingConversations(activeOrgId),
								icon: Mail01Icon,
							},
							...(canManageOrg
								? [
										{
											label: "Invites",
											href: dashboardRoutes.orgs.invites(activeOrgId),
											icon: UserAdd01Icon,
										},
										{
											label: "Settings",
											href: dashboardRoutes.orgs.settings(activeOrgId),
											icon: Settings01Icon,
										},
									]
								: []),
						],
					},
				]
			: [
					{
						links: [
							{ label: "Dashboard", href: dashboardRoutes.home, icon: Home01Icon, exact: true },
						],
					},
					{
						label: "Personal",
						links: [
							{ label: "Profile", href: dashboardRoutes.personal.profile, icon: UserCircle02Icon },
							{
								label: "Notifications",
								href: dashboardRoutes.personal.notifications,
								icon: Mail01Icon,
							},
							{
								label: "Invitations",
								href: dashboardRoutes.personal.invitations,
								icon: UserAdd01Icon,
							},
							{
								label: "Settings",
								href: dashboardRoutes.personal.settings.account,
								icon: Settings01Icon,
							},
						],
					},
					{
						label: "Recruiting",
						links: [
							{ label: "Posts", href: dashboardRoutes.discover.posts, icon: UserSearch01Icon },
							{
								label: "Conversations",
								href: dashboardRoutes.discover.conversations,
								icon: Mail01Icon,
							},
						],
					},
					{
						label: "Workspace",
						links: [
							{ label: "Organizations", href: dashboardRoutes.organizations, icon: UserGroupIcon },
						],
					},
				];

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<ContextSwitcher orgs={contextOrgs} teams={contextTeams} />
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
			</SidebarContent>
			<SidebarFooter>
				<SidebarUserNav user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function SidebarUserNav({ user }: { user: UserMenuUser }) {
	const { isMobile } = useSidebar();
	const initials = getUserInitials(user.displayName);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<UserMenuDropdown
					user={user}
					align="start"
					side={isMobile ? "bottom" : "right"}
					sideOffset={4}
				>
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						aria-label="User menu"
					>
						<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
							<AvatarImage className="rounded-none" src={user.avatarUrl ?? undefined} />
							<AvatarFallback className="rounded-none text-xs">{initials}</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 text-left leading-tight">
							<span className="truncate text-sm font-medium">{user.displayName}</span>
							<span className="truncate text-xs text-muted-foreground">{user.email}</span>
						</div>
					</SidebarMenuButton>
				</UserMenuDropdown>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
