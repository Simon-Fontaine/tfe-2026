import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
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
			<PageContainer>
				<PageHeader title="Settings" detail={`Team ${teamId}`} />
				<EmptyStateBlock
					icon={LockIcon}
					title="No access"
					description="You need an active team membership before you can open this settings workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (!team.data.currentUser.canManage && !team.data.currentUser.canLeave) {
		return (
			<PageContainer>
				<PageHeader title="Settings" detail={`[${team.data.tag}] ${team.data.name}`} />
				<EmptyStateBlock
					icon={LockIcon}
					title="No access"
					description="You don't have permission to manage this team's settings."
					variant="card"
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				detail={`[${team.data.tag}] ${team.data.name}`}
				description="Manage team profile, recruiting, and workspace lifecycle actions."
			/>
			<TeamSettingsPanel team={team.data} />
		</PageContainer>
	);
}
