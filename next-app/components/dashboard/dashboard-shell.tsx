"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardShellProps {
	user: SessionUser;
	children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
	return (
		<SidebarProvider>
			<DashboardSidebar user={user} />
			<SidebarInset>
				<header className="flex h-12 shrink-0 items-center border-b px-3">
					<SidebarTrigger />
				</header>
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
