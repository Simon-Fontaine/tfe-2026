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
	SidebarSeparator,
} from "@/components/ui/sidebar";
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

const DISCOVER_LINKS = [
	{ label: "Posts", href: "/dashboard/discover/posts", icon: UserSearch01Icon },
	{ label: "Conversations", href: "/dashboard/discover/conversations", icon: Mail01Icon },
	{ label: "Invitations", href: "/dashboard/discover/invitations", icon: UserAdd01Icon },
];

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
				: [
						{
							links: [{ label: "Dashboard", href: "/dashboard", icon: Home01Icon, exact: true }],
						},
						{
							label: "Personal",
							links: [
								{ label: "Profile", href: "/dashboard/personal/profile", icon: UserCircle02Icon },
								{ label: "Schedule", href: "/dashboard/personal/schedule", icon: Calendar03Icon },
								{
									label: "Notifications",
									href: "/dashboard/personal/notifications",
									icon: Mail01Icon,
								},
								{
									label: "Settings",
									href: "/dashboard/personal/settings/account",
									icon: Settings01Icon,
								},
							],
						},
						{
							label: "Workspace",
							links: [
								{ label: "Organizations", href: "/dashboard/organizations", icon: UserGroupIcon },
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

				{/* Discover section — always visible regardless of context */}
				{(activeOrgId || activeTeamId) && (
					<>
						<SidebarSeparator />
						<SidebarGroup>
							<SidebarGroupLabel>Discover</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{DISCOVER_LINKS.map((link) => {
										const isActive = pathname.startsWith(link.href);
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
					</>
				)}
			</SidebarContent>
		</Sidebar>
	);
}
