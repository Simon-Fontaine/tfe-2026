import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamUpdatesPageClient } from "@/components/updates/team-updates-page-client";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { getTeamUpdatesRouteState } from "@/lib/data/updates";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamUpdatesPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ cursor?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const { cursor } = await searchParams;
	const team = await getTeamWithRosterRouteState(teamId, user.id);

	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return <AccessGate title="Updates" resourceType="team" />;
	}
	if (!team.data.currentUser.canViewUpdates) {
		return <AccessGate title="Updates" resourceType="team" />;
	}

	const updates = await getTeamUpdatesRouteState(teamId, cursor);
	if (updates.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Updates"
					detail={`[${team.data.tag}] ${team.data.name}`}
					description="Announcements, roster news, and scrim recaps posted by team managers."
				/>
				<EmptyStateBlock
					title={updates.kind === "no-access" ? "No access" : "Updates unavailable"}
					description={
						updates.kind === "no-access"
							? "You do not have permission to read this team's updates."
							: "This team's update feed could not be opened from the current route."
					}
					variant="card"
				/>
			</PageContainer>
		);
	}

	const { posts, nextCursor } = updates.data;

	return (
		<PageContainer>
			<PageHeader
				title="Updates"
				description="Announcements, roster news, and scrim recaps posted by your team's managers."
			/>

			<TeamUpdatesPageClient
				teamId={team.data.id}
				canManage={team.data.currentUser.canManage}
				initialUpdates={posts}
			/>
			{nextCursor && <LoadMoreButton nextCursor={nextCursor} />}
		</PageContainer>
	);
}
