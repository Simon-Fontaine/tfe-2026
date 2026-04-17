"use client";

import { InboxRealtimeBootstrap } from "@/components/notifications/inbox-realtime-bootstrap";
import { RecruitingRealtimeBootstrap } from "@/components/recruit/recruiting-realtime-bootstrap";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import type { SwitcherOrg, SwitcherTeam } from "./context-switcher";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface WorkspaceShellProps {
	user: SessionUser;
	unreadCount: number;
	pendingApplicationCount: number;
	contextOrgs: SwitcherOrg[];
	contextTeams: SwitcherTeam[];
	children: React.ReactNode;
}

export function WorkspaceShell({
	user,
	unreadCount,
	pendingApplicationCount,
	contextOrgs,
	contextTeams,
	children,
}: WorkspaceShellProps) {
	return (
		<SidebarProvider>
			<InboxRealtimeBootstrap initialUnreadCount={unreadCount} />
			<RecruitingRealtimeBootstrap initialPendingCount={pendingApplicationCount} />
			<WorkspaceSidebar
				user={user}
				contextOrgs={contextOrgs}
				contextTeams={contextTeams}
				pendingApplicationCount={pendingApplicationCount}
			/>
			<SidebarInset>
				<WorkspaceHeader orgs={contextOrgs} teams={contextTeams} unreadCount={unreadCount} />
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
