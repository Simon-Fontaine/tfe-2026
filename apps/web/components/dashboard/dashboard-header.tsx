"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserMenuUser } from "@/components/shared/user-menu-dropdown";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
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
			{/* Left zone */}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<SidebarTrigger />
				{crumbs.length > 0 && (
					<>
						<Separator orientation="vertical" className="mx-1 h-4" />
						<nav
							aria-label="Breadcrumb"
							className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
						>
							{crumbs.map((crumb, i) => (
								<span key={crumb.label} className="flex items-center gap-1">
									{i > 0 && (
										<HugeiconsIcon
											icon={ArrowRight01Icon}
											strokeWidth={2}
											className="size-3 shrink-0"
										/>
									)}
									{crumb.href ? (
										<Link
											href={crumb.href}
											className="truncate transition-colors hover:text-foreground"
										>
											{crumb.label}
										</Link>
									) : (
										<span className="truncate font-medium text-foreground">{crumb.label}</span>
									)}
								</span>
							))}
						</nav>
					</>
				)}
			</div>

			{/* Right zone */}
			<HeaderActions user={user} unreadCount={unreadCount} />
		</header>
	);
}
