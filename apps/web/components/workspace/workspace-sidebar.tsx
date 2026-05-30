"use client";

import {
	Calendar03Icon,
	Home01Icon,
	Mail01Icon,
	Notification01Icon,
	Settings01Icon,
	Sword03Icon,
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
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import { getWorkspacePathContext } from "@/lib/route-state";
import { appRoutes } from "@/lib/routes";
import { useRecruitingStore } from "@/stores/recruiting";
import { useScrimStore } from "@/stores/scrims";
import { ContextSwitcher, type SwitcherOrg, type SwitcherTeam } from "./context-switcher";

interface WorkspaceSidebarProps {
	user: SessionUser;
	contextOrgs: SwitcherOrg[];
	contextTeams: SwitcherTeam[];
	pendingApplicationCount: number;
}

function isSidebarLinkActive(pathname: string, href: string, exact?: boolean) {
	if (exact) return pathname === href;

	if (href === appRoutes.recruiting.root) {
		return (
			pathname === href ||
			(pathname.startsWith(`${href}/`) && !pathname.startsWith(appRoutes.recruiting.conversations))
		);
	}

	return pathname.startsWith(href);
}

export function WorkspaceSidebar({
	user,
	contextOrgs,
	contextTeams,
	pendingApplicationCount,
}: WorkspaceSidebarProps) {
	const pathname = usePathname();
	const livePendingApplicationCount = useRecruitingStore((state) => state.pendingApplicationCount);
	const liveScrimTeamId = useScrimStore((state) => state.teamId);
	const liveScrimNeedsActionCount = useScrimStore((state) => state.needsActionCount);
	const { activeOrgId, activeTeamId } = getWorkspacePathContext(pathname);
	const displayPendingApplicationCount = livePendingApplicationCount ?? pendingApplicationCount;
	const displayScrimNeedsActionCount =
		liveScrimTeamId === activeTeamId ? (liveScrimNeedsActionCount ?? undefined) : undefined;

	const activeOrg = activeOrgId ? contextOrgs.find((o) => o.id === activeOrgId) : null;
	const activeTeam = activeTeamId ? contextTeams.find((t) => t.id === activeTeamId) : null;
	const canManageOrg = activeOrg?.canManage ?? false;
	const canOpenTeamSettings =
		(activeTeam?.canManageSettings ?? false) || (activeTeam?.canLeave ?? false);

	const contextGroups = activeTeam
		? [
				{
					label: "Team",
					links: [
						{
							label: "Overview",
							href: appRoutes.teams.byId(activeTeam.id),
							icon: Home01Icon,
							exact: true,
						},
						...(activeTeam?.canViewRoster
							? [
									{
										label: "Roster",
										href: appRoutes.teams.roster(activeTeam.id),
										icon: UserGroupIcon,
									},
								]
							: []),
						...(activeTeam?.canViewSchedule
							? [
									{
										label: "Team schedule",
										href: appRoutes.teams.calendar(activeTeam.id),
										icon: Calendar03Icon,
									},
								]
							: []),
						...(activeTeam?.canViewScrims
							? [
									{
										label: "Scrims",
										href: appRoutes.teams.scrims(activeTeam.id),
										icon: Sword03Icon,
										badge: displayScrimNeedsActionCount,
									},
								]
							: []),
						...(activeTeam?.canViewRecruiting
							? [
									{
										label: "Recruiting",
										href: appRoutes.teams.recruiting(activeTeam.id),
										icon: UserSearch01Icon,
									},
								]
							: []),
						...(activeTeam?.canViewChat
							? [
									{
										label: "Chat",
										href: appRoutes.teams.chat(activeTeam.id),
										icon: Mail01Icon,
									},
								]
							: []),
						...(activeTeam?.canViewUpdates
							? [
									{
										label: "Updates",
										href: appRoutes.teams.updates(activeTeam.id),
										icon: Notification01Icon,
									},
								]
							: []),
						...(canOpenTeamSettings
							? [
									{
										label: "Settings",
										href: appRoutes.teams.settings(activeTeam.id),
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
								href: appRoutes.orgs.byId(activeOrgId),
								icon: Home01Icon,
								exact: true,
							},
							{ label: "Teams", href: appRoutes.orgs.teams(activeOrgId), icon: Sword03Icon },
							{
								label: "Staff",
								href: appRoutes.orgs.staff(activeOrgId),
								icon: UserGroupIcon,
							},
							{
								label: "Updates",
								href: appRoutes.orgs.updates(activeOrgId),
								icon: Notification01Icon,
							},
							...(canManageOrg
								? [
										{
											label: "Invites",
											href: appRoutes.orgs.invites(activeOrgId),
											icon: Mail01Icon,
										},
									]
								: []),
							...(canManageOrg
								? [
										{
											label: "Brand",
											href: appRoutes.orgs.brand(activeOrgId),
											icon: UserSearch01Icon,
										},
										{
											label: "Recruiting",
											href: appRoutes.orgs.recruiting(activeOrgId),
											icon: UserSearch01Icon,
										},
										{
											label: "Settings",
											href: appRoutes.orgs.settings(activeOrgId),
											icon: Settings01Icon,
										},
									]
								: []),
						],
					},
				]
			: [
					{
						links: [{ label: "Home", href: appRoutes.me, icon: Home01Icon, exact: true }],
					},
					{
						label: "Personal",
						links: [
							{ label: "Profile", href: appRoutes.profile, icon: UserCircle02Icon },
							{
								label: "Organizations",
								href: appRoutes.orgs.root,
								icon: UserGroupIcon,
							},
							{
								label: "Inbox",
								href: appRoutes.inbox,
								icon: Mail01Icon,
							},
							{
								label: "Personal schedule",
								href: appRoutes.calendar,
								icon: Calendar03Icon,
							},
							{
								label: "Settings",
								href: appRoutes.settings.account,
								icon: Settings01Icon,
							},
						],
					},
					{
						label: "Recruiting",
						links: [
							{
								label: "Marketplace",
								href: appRoutes.recruiting.root,
								icon: UserSearch01Icon,
								badge: displayPendingApplicationCount,
							},
							{
								label: "Conversations",
								href: appRoutes.recruiting.conversations,
								icon: Mail01Icon,
							},
						],
					},
				];

	return (
		<Sidebar collapsible="offcanvas">
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
									const isActive = isSidebarLinkActive(pathname, link.href, isExact);
									return (
										<SidebarMenuItem key={link.href}>
											<SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
												<Link href={link.href} prefetch={false}>
													<HugeiconsIcon icon={link.icon} strokeWidth={2} />
													{link.label}
												</Link>
											</SidebarMenuButton>
											{"badge" in link && link.badge && link.badge > 0 && (
												<SidebarMenuBadge>{link.badge}</SidebarMenuBadge>
											)}
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
