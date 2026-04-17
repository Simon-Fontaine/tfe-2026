"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appRoutes } from "@/lib/routes";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
import { HeaderActions } from "./header-actions";

interface WorkspaceHeaderProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
	unreadCount: number;
}

const SUB_PAGE_LABELS: Record<string, string> = {
	teams: "Teams",
	members: "Members",
	staff: "Staff",
	settings: "Settings",
	profile: "Profile",
	notifications: "Inbox",
	inbox: "Inbox",
	account: "Account",
	security: "Security",
	conversations: "Conversations",
	invitations: "Invitations",
	invites: "Invites",
	roster: "Roster",
	recruiting: "Recruiting",
	overview: "Overview",
	calendar: "Calendar",
	scrims: "Scrims",
	chat: "Chat",
	updates: "Updates",
	brand: "Brand",
	me: "Home",
	activity: "Activity",
	orgs: "Organizations",
	schedule: "Schedule",
};

function useBreadcrumbs(pathname: string, orgs: SwitcherOrg[], teams: SwitcherTeam[]) {
	const crumbs: { label: string; href?: string }[] = [];

	const appTeamMatch = pathname.match(/^\/app\/teams\/([^/]+)(?:\/([^/]+))?/);
	if (appTeamMatch) {
		const [, teamId, subPage] = appTeamMatch;
		const team = teams.find((t) => t.id === teamId);
		if (team) {
			const teamLabel = `[${team.tag}] ${team.name}`;
			if (!subPage || subPage === "overview") {
				crumbs.push({ label: teamLabel });
			} else if (SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: teamLabel, href: appRoutes.teams.byId(teamId) });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			}
		}
		return crumbs;
	}

	const appOrgMatch = pathname.match(/^\/app\/orgs\/([^/]+)(?:\/([^/]+))?/);
	if (appOrgMatch) {
		const [, orgId, subPage] = appOrgMatch;
		const org = orgs.find((o) => o.id === orgId);
		if (org) {
			if (!subPage || subPage === "overview") {
				crumbs.push({ label: org.name });
			} else if (SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: org.name, href: appRoutes.orgs.byId(orgId) });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			}
		}
		return crumbs;
	}

	if (pathname === appRoutes.orgs.root) {
		crumbs.push({ label: "Organizations" });
		return crumbs;
	}

	const appSettingsMatch = pathname.match(/^\/app\/settings(?:\/([^/]+))?/);
	if (appSettingsMatch) {
		const [, subPage] = appSettingsMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Settings", href: appRoutes.settings.account });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Settings" });
		}
		return crumbs;
	}

	const appRecruitingMatch = pathname.match(/^\/app\/recruiting(?:\/([^/]+))?/);
	if (appRecruitingMatch) {
		const [, subPage] = appRecruitingMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Recruiting", href: appRoutes.recruiting.root });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Recruiting" });
		}
		return crumbs;
	}

	const appPersonalMatch = pathname.match(/^\/app\/(me|profile|inbox|calendar)$/);
	if (appPersonalMatch) {
		const [, page] = appPersonalMatch;
		if (SUB_PAGE_LABELS[page]) {
			crumbs.push({ label: SUB_PAGE_LABELS[page] });
		}
		return crumbs;
	}

	if (pathname === appRoutes.root) {
		crumbs.push({ label: "App" });
		return crumbs;
	}

	return crumbs;
}

export function WorkspaceHeader({ orgs, teams, unreadCount }: WorkspaceHeaderProps) {
	const pathname = usePathname();
	const crumbs = useBreadcrumbs(pathname, orgs, teams);

	return (
		<header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex min-w-0 flex-1 items-center gap-2 px-4">
				<SidebarTrigger className="-ml-1" />
				{crumbs.length > 0 && (
					<>
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb className="min-w-0">
							<BreadcrumbList className="min-w-0">
								{crumbs.map((crumb, i) => (
									<Fragment key={`${crumb.label}-${crumb.href ?? i}`}>
										{i > 0 ? <BreadcrumbSeparator /> : null}
										<BreadcrumbItem>
											{crumb.href ? (
												<BreadcrumbLink asChild>
													<Link href={crumb.href} className="truncate">
														{crumb.label}
													</Link>
												</BreadcrumbLink>
											) : (
												<BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
											)}
										</BreadcrumbItem>
									</Fragment>
								))}
							</BreadcrumbList>
						</Breadcrumb>
					</>
				)}
			</div>

			<div className="px-4">
				<HeaderActions unreadCount={unreadCount} />
			</div>
		</header>
	);
}
