"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";

interface DashboardHeaderProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
}

const SUB_PAGE_LABELS: Record<string, string> = {
	teams: "Teams",
	members: "Members",
	posts: "Posts",
	settings: "Settings",
	players: "Players",
	staff: "Staff",
};

function useBreadcrumbs(pathname: string, orgs: SwitcherOrg[], teams: SwitcherTeam[]) {
	const crumbs: { label: string; href?: string }[] = [];

	const teamMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)\/team\/([^/]+)(?:\/(\w+))?/);
	const orgMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)(?:\/(\w+))?$/);

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
	} else if (orgMatch) {
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
	} else if (pathname.startsWith("/dashboard/organizations")) {
		crumbs.push({ label: "Organizations" });
	} else if (pathname.startsWith("/dashboard/personal/settings")) {
		crumbs.push({ label: "Settings" });
	} else if (pathname.startsWith("/dashboard/personal/profile")) {
		crumbs.push({ label: "Profile" });
	} else if (pathname.startsWith("/dashboard/personal/schedule")) {
		crumbs.push({ label: "Schedule" });
	} else if (pathname.startsWith("/dashboard/personal/notifications")) {
		crumbs.push({ label: "Notifications" });
	} else if (pathname.startsWith("/dashboard/discover")) {
		crumbs.push({ label: "Discover" });
	}

	return crumbs;
}

export function DashboardHeader({ orgs, teams }: DashboardHeaderProps) {
	const pathname = usePathname();
	const crumbs = useBreadcrumbs(pathname, orgs, teams);

	return (
		<header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
			<SidebarTrigger />
			{crumbs.length > 0 && (
				<nav className="flex items-center gap-1 text-xs text-muted-foreground">
					{crumbs.map((crumb, i) => (
						<span key={crumb.label} className="flex items-center gap-1">
							{i > 0 && (
								<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3" />
							)}
							{crumb.href ? (
								<Link href={crumb.href} className="transition-colors hover:text-foreground">
									{crumb.label}
								</Link>
							) : (
								<span className="text-foreground">{crumb.label}</span>
							)}
						</span>
					))}
				</nav>
			)}
		</header>
	);
}
