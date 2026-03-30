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
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
import { HeaderActions } from "./header-actions";

interface DashboardHeaderProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
	unreadCount: number;
}

const SUB_PAGE_LABELS: Record<string, string> = {
	teams: "Teams",
	members: "Members",
	posts: "Posts",
	settings: "Settings",
	profile: "Profile",
	notifications: "Notifications",
	account: "Account",
	security: "Security",
	conversations: "Conversations",
	invitations: "Invitations",
	invites: "Invites",
	roster: "Roster",
	recruiting: "Recruiting",
	activity: "Activity",
	orgs: "Organizations",
	schedule: "Schedule",
};

function useBreadcrumbs(pathname: string, orgs: SwitcherOrg[], teams: SwitcherTeam[]) {
	const crumbs: { label: string; href?: string }[] = [];

	// Team context: org > team > sub-page
	const teamMatch = pathname.match(/^\/dashboard\/teams\/([^/]+)(?:\/(\w+))?/);
	if (teamMatch) {
		const [, teamId, subPage] = teamMatch;
		const team = teams.find((t) => t.id === teamId);
		if (team) {
			const teamLabel = `[${team.tag}] ${team.name}`;
			if (subPage && SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: teamLabel, href: `/dashboard/teams/${teamId}` });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			} else {
				crumbs.push({ label: teamLabel });
			}
		}
		return crumbs;
	}

	// Org context: org > sub-page
	const orgMatch = pathname.match(/^\/dashboard\/orgs\/([^/]+)(?:\/(\w+))?$/);
	if (orgMatch) {
		const [, orgId, subPage] = orgMatch;
		const org = orgs.find((o) => o.id === orgId);
		if (org) {
			if (subPage && SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: org.name, href: `/dashboard/orgs/${orgId}` });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			} else {
				crumbs.push({ label: org.name });
			}
		}
		return crumbs;
	}

	// Personal settings: Settings > Account/Security
	const settingsMatch = pathname.match(/^\/dashboard\/settings(?:\/(\w+))?/);
	if (settingsMatch) {
		const [, subPage] = settingsMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Settings", href: "/dashboard/settings/account" });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Settings" });
		}
		return crumbs;
	}

	// Discover: Discover > Posts/Conversations/Invitations
	const discoverMatch = pathname.match(/^\/dashboard\/recruiting(?:\/(\w+))?/);
	if (discoverMatch) {
		const [, subPage] = discoverMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Discover", href: "/dashboard/recruiting/posts" });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Discover" });
		}
		return crumbs;
	}

	// Personal sub-pages
	const personalMatch = pathname.match(/^\/dashboard\/(profile|notifications|invitations)/);
	if (personalMatch) {
		const [, page] = personalMatch;
		if (SUB_PAGE_LABELS[page]) {
			crumbs.push({ label: SUB_PAGE_LABELS[page] });
		}
		return crumbs;
	}

	// Organizations list
	if (pathname.startsWith("/dashboard/orgs")) {
		crumbs.push({ label: "Organizations" });
		return crumbs;
	}

	// Dashboard home
	if (pathname === "/dashboard") {
		crumbs.push({ label: "Dashboard" });
	}

	return crumbs;
}

export function DashboardHeader({ orgs, teams, unreadCount }: DashboardHeaderProps) {
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
