import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceShellData, requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const { user } = await requireWorkspaceSession();
	const { unreadCount, contextOrgs, contextTeams, pendingApplicationCount } =
		await getWorkspaceShellData(user.id);

	return (
		<WorkspaceShell
			user={user}
			unreadCount={unreadCount}
			pendingApplicationCount={pendingApplicationCount}
			contextOrgs={contextOrgs}
			contextTeams={contextTeams}
		>
			{children}
		</WorkspaceShell>
	);
}
