import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function OrgTeamsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;

	return (
		<PageContainer>
			<PageHeader
				title="Teams"
				description={`Manage active and archived rosters for ${org.name}.`}
				actions={
					canManage ? (
						<CreateTeamDialog orgId={org.id}>
							<Button size="sm">
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New team
							</Button>
						</CreateTeamDialog>
					) : undefined
				}
			/>

			<PageSection title="Active teams">
				{org.activeTeams.length === 0 ? (
					<EmptyStateBlock
						title="No active teams"
						description="Create a team to get started."
						variant="card"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.activeTeams.map((team) => (
							<TeamCard key={team.id} team={team} orgId={org.id} />
						))}
					</div>
				)}
			</PageSection>

			{org.archivedTeams.length > 0 && (
				<PageSection title="Archived teams">
					<div className="grid gap-3 sm:grid-cols-2">
						{org.archivedTeams.map((team) => (
							<TeamCard key={team.id} team={team} orgId={org.id} />
						))}
					</div>
				</PageSection>
			)}
		</PageContainer>
	);
}
