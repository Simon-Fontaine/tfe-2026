"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import type { UserMenuUser } from "@/components/shared/user-menu-dropdown";
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
import { ContextSwitcher, type SwitcherOrg, type SwitcherTeam } from "./context-switcher";
import { HeaderActions } from "./header-actions";

interface DashboardHeaderProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
	user: UserMenuUser;
	unreadCount: number;
}

const SUB_PAGE_LABELS: Record<string, string> = {
	teams: "Teams",
	members: "Members",
	posts: "Posts",
	settings: "Settings",
	players: "Players",
	staff: "Staff",
	profile: "Profile",
	schedule: "Schedule",
	notifications: "Notifications",
	account: "Account",
	security: "Security",
	conversations: "Conversations",
	invitations: "Invitations",
	invites: "Invites",
};

function useBreadcrumbs(pathname: string, orgs: SwitcherOrg[], teams: SwitcherTeam[]) {
	const crumbs: { label: string; href?: string }[] = [];

	// Team context: org > team > sub-page
	const teamMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)\/team\/([^/]+)(?:\/(\w+))?/);
	if (teamMatch) {
		const [, orgId, teamId, subPage] = teamMatch;
		const org = orgs.find((o) => o.id === orgId);
		const team = teams.find((t) => t.id === teamId);
		if (org) crumbs.push({ label: org.name, href: `/dashboard/c/org/${orgId}` });
		if (team) {
			const teamLabel = `[${team.tag}] ${team.name}`;
			if (subPage && SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: teamLabel, href: `/dashboard/c/org/${orgId}/team/${teamId}` });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			} else {
				crumbs.push({ label: teamLabel });
			}
		}
		return crumbs;
	}

	// Org context: org > sub-page
	const orgMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)(?:\/(\w+))?$/);
	if (orgMatch) {
		const [, orgId, subPage] = orgMatch;
		const org = orgs.find((o) => o.id === orgId);
		if (org) {
			if (subPage && SUB_PAGE_LABELS[subPage]) {
				crumbs.push({ label: org.name, href: `/dashboard/c/org/${orgId}` });
				crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
			} else {
				crumbs.push({ label: org.name });
			}
		}
		return crumbs;
	}

	// Personal settings: Settings > Account/Security
	const settingsMatch = pathname.match(/^\/dashboard\/personal\/settings(?:\/(\w+))?/);
	if (settingsMatch) {
		const [, subPage] = settingsMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Settings", href: "/dashboard/personal/settings/account" });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Settings" });
		}
		return crumbs;
	}

	// Discover: Discover > Posts/Conversations/Invitations
	const discoverMatch = pathname.match(/^\/dashboard\/discover(?:\/(\w+))?/);
	if (discoverMatch) {
		const [, subPage] = discoverMatch;
		if (subPage && SUB_PAGE_LABELS[subPage]) {
			crumbs.push({ label: "Discover", href: "/dashboard/discover/posts" });
			crumbs.push({ label: SUB_PAGE_LABELS[subPage] });
		} else {
			crumbs.push({ label: "Discover" });
		}
		return crumbs;
	}

	// Personal sub-pages
	const personalMatch = pathname.match(/^\/dashboard\/personal\/(\w+)/);
	if (personalMatch) {
		const [, page] = personalMatch;
		if (SUB_PAGE_LABELS[page]) {
			crumbs.push({ label: SUB_PAGE_LABELS[page] });
		}
		return crumbs;
	}

	// Organizations list
	if (pathname.startsWith("/dashboard/organizations")) {
		crumbs.push({ label: "Organizations" });
		return crumbs;
	}

	// Dashboard home
	if (pathname === "/dashboard") {
		crumbs.push({ label: "Dashboard" });
	}

	return crumbs;
}

export function DashboardHeader({ orgs, teams, user, unreadCount }: DashboardHeaderProps) {
	const pathname = usePathname();
	const crumbs = useBreadcrumbs(pathname, orgs, teams);

	return (
		<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<SidebarTrigger className="md:hidden" />
				<ContextSwitcher
					orgs={orgs}
					teams={teams}
					placement="header"
					className="min-w-0 max-w-[15rem] sm:max-w-[18rem] md:max-w-[22rem]"
				/>
				{crumbs.length > 0 && (
					<>
						<Separator orientation="vertical" className="mx-1 h-4" />
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

			<HeaderActions user={user} unreadCount={unreadCount} />
		</header>
	);
}
