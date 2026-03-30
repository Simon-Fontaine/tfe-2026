import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

export default async function TeamSettingsPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	if (!team.currentUser.canManage && !team.currentUser.canLeave) {
		return (
			<PageContainer>
				<PageHeader title="Settings" />
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
				description="Manage team profile, recruiting, membership policy, and workspace lifecycle actions."
			/>
			<TeamSettingsPanel team={team} />
		</PageContainer>
	);
}
