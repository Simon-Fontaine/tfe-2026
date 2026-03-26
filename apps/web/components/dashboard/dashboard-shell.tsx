"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
import { DashboardHeader } from "./dashboard-header";
import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardShellProps {
	user: SessionUser;
	unreadCount: number;
	contextOrgs: SwitcherOrg[];
	contextTeams: SwitcherTeam[];
	children: React.ReactNode;
}

export function DashboardShell({
	user,
	unreadCount,
	contextOrgs,
	contextTeams,
	children,
}: DashboardShellProps) {
	return (
		<SidebarProvider>
			<DashboardSidebar
				user={user}
				unreadCount={unreadCount}
				contextOrgs={contextOrgs}
				contextTeams={contextTeams}
			/>
			<SidebarInset>
				<DashboardHeader orgs={contextOrgs} teams={contextTeams} />
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
