import { notFound } from "next/navigation";
import { TeamUpdatesPageClient } from "@/components/updates/team-updates-page-client";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { getTeamUpdates } from "@/lib/data/updates";

export default async function TeamUpdatesPage({ params }: { params: Promise<{ teamId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { teamId } = await params;
	const [team, updates] = await Promise.all([
		getTeamWithRoster(teamId, user.id),
		getTeamUpdates(teamId),
	]);

	if (!team) notFound();

	return (
		<PageContainer>
			<PageHeader
				title="Updates"
				description={`Team announcements, roster notes, and scrim recaps for ${team.name} now live in their own feed instead of being mixed into recruiting.`}
			/>

			<TeamUpdatesPageClient
				teamId={team.id}
				canManage={team.currentUser.canManage}
				initialUpdates={updates}
			/>
		</PageContainer>
	);
}
