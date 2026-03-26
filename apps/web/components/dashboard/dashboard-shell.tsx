"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
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
				<header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background px-3">
					<SidebarTrigger />
				</header>
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
