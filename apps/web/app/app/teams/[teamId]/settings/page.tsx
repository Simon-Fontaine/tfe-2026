import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppTeamSettingsPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return (
			<AccessGate
				title="Settings"
				resourceType="team"
				reason={team.kind === "no-access" ? team.reason : undefined}
			/>
		);
	}

	if (!team.data.currentUser.canManageSettings && !team.data.currentUser.canLeave) {
		return <AccessGate title="Settings" resourceType="team" reason="role" />;
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				detail={`[${team.data.tag}] ${team.data.name}`}
				description="Manage team profile, recruiting, and workspace lifecycle actions."
			/>
			<TeamSettingsPanel team={team.data} currentUserId={user.id} />
		</PageContainer>
	);
}
