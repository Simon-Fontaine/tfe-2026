import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamUpdatesPageClient } from "@/components/updates/team-updates-page-client";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { getTeamUpdates } from "@/lib/data/updates";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamUpdatesPage({ params }: { params: Promise<{ teamId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);

	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Updates"
					detail={`Team ${teamId}`}
					description="Announcements, roster news, and scrim recaps posted by team managers."
				/>
				<EmptyStateBlock
					title="No access"
					description="You need an active team membership before you can read this team's updates."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const updates = await getTeamUpdates(teamId);

	return (
		<PageContainer>
			<PageHeader
				title="Updates"
				description="Announcements, roster news, and scrim recaps posted by your team's managers."
			/>

			<TeamUpdatesPageClient
				teamId={team.data.id}
				canManage={team.data.currentUser.canManage}
				initialUpdates={updates}
			/>
		</PageContainer>
	);
}
