import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

export default async function TeamInvitesPage({ params }: { params: Promise<{ teamId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	return (
		<PageContainer>
			<PageHeader title="Invites" description={`Pending team invites for ${team.name}.`} />
			{!team.currentUser.canManageInvites ? (
				<EmptyStateBlock
					icon={LockIcon}
					title="No access"
					description="You do not have permission to manage team invites."
					variant="card"
				/>
			) : (
				<PageSection title="Pending invites">
					<TeamInvitesSection teamId={team.id} invites={team.pendingInvites} />
				</PageSection>
			)}
		</PageContainer>
	);
}
