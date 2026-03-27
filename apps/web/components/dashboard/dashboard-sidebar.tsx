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
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { dashboardRoutes } from "@/lib/routes";
import { ContextSwitcher, type SwitcherOrg, type SwitcherTeam } from "./context-switcher";

interface DashboardSidebarProps {
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

export function DashboardSidebar({ contextOrgs, contextTeams }: DashboardSidebarProps) {
	const pathname = usePathname();
	const { activeOrgId, activeTeamId } = useActiveContext(pathname);

	const contextGroups =
		activeTeamId && activeOrgId
			? [
					{
						label: "Team",
						links: [
							{
								label: "Overview",
								href: dashboardRoutes.context.teamById(activeOrgId, activeTeamId),
								icon: Home01Icon,
								exact: true,
							},
							{
								label: "Players",
								href: dashboardRoutes.context.teamPlayers(activeOrgId, activeTeamId),
								icon: UserGroupIcon,
							},
							{
								label: "Staff",
								href: dashboardRoutes.context.teamStaff(activeOrgId, activeTeamId),
								icon: UserAdd01Icon,
							},
							{
								label: "Posts",
								href: dashboardRoutes.context.teamPosts(activeOrgId, activeTeamId),
								icon: UserSearch01Icon,
							},
							{
								label: "Conversations",
								href: dashboardRoutes.context.teamConversations(activeOrgId, activeTeamId),
								icon: Mail01Icon,
							},
							{
								label: "Invites",
								href: dashboardRoutes.context.teamInvites(activeOrgId, activeTeamId),
								icon: UserAdd01Icon,
							},
							{
								label: "Settings",
								href: dashboardRoutes.context.teamSettings(activeOrgId, activeTeamId),
								icon: Settings01Icon,
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
									href: dashboardRoutes.context.orgById(activeOrgId),
									icon: Home01Icon,
									exact: true,
								},
								{
									label: "Teams",
									href: dashboardRoutes.context.orgTeams(activeOrgId),
									icon: Sword03Icon,
								},
								{
									label: "Members",
									href: dashboardRoutes.context.orgMembers(activeOrgId),
									icon: UserGroupIcon,
								},
								{
									label: "Posts",
									href: dashboardRoutes.context.orgPosts(activeOrgId),
									icon: UserSearch01Icon,
								},
								{
									label: "Conversations",
									href: dashboardRoutes.context.orgConversations(activeOrgId),
									icon: Mail01Icon,
								},
								{
									label: "Invites",
									href: dashboardRoutes.context.orgInvites(activeOrgId),
									icon: UserAdd01Icon,
								},
								{
									label: "Settings",
									href: dashboardRoutes.context.orgSettings(activeOrgId),
									icon: Settings01Icon,
								},
							],
						},
					]
				: [
						{
							links: [
								{
									label: "Dashboard",
									href: dashboardRoutes.home,
									icon: Home01Icon,
									exact: true,
								},
							],
						},
						{
							label: "Personal",
							links: [
								{
									label: "Profile",
									href: dashboardRoutes.personal.profile,
									icon: UserCircle02Icon,
								},
								{
									label: "Schedule",
									href: dashboardRoutes.personal.schedule,
									icon: Calendar03Icon,
								},
								{
									label: "Notifications",
									href: dashboardRoutes.personal.notifications,
									icon: Mail01Icon,
								},
								{
									label: "Settings",
									href: dashboardRoutes.personal.settings.account,
									icon: Settings01Icon,
								},
							],
						},
						{
							label: "Discover",
							links: [
								{ label: "Posts", href: dashboardRoutes.discover.posts, icon: UserSearch01Icon },
								{
									label: "Conversations",
									href: dashboardRoutes.discover.conversations,
									icon: Mail01Icon,
								},
								{
									label: "Invitations",
									href: dashboardRoutes.discover.invitations,
									icon: UserAdd01Icon,
								},
							],
						},
						{
							label: "Workspace",
							links: [
								{
									label: "Organizations",
									href: dashboardRoutes.organizations,
									icon: UserGroupIcon,
								},
							],
						},
					];

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
			</SidebarContent>
		</Sidebar>
	);
}
