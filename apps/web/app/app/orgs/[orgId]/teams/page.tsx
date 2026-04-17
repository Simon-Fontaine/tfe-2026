import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";

export default async function AppOrgTeamsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	return (
		<PageContainer>
			<PageHeader
				title="Teams"
				description={`Manage active and archived rosters for ${org.name}.`}
				actions={
					org.currentUser.canManage ? <CreateTeamDialog orgId={org.id} showTrigger /> : undefined
				}
			/>

			<PageSection title="Active teams" description="Current rosters that are still competing.">
				{org.activeTeams.length === 0 ? (
					<EmptyStateBlock
						title="No active teams"
						description="Create a team to get started."
						variant="card"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.activeTeams.map((team) => (
							<TeamCard
								key={team.id}
								team={team}
								orgId={org.id}
								href={appRoutes.teams.byId(team.id)}
							/>
						))}
					</div>
				)}
			</PageSection>

			{org.archivedTeams.length > 0 && (
				<PageSection
					title="Archived teams"
					description="Historic rosters retained for context and recordkeeping."
				>
					<div className="grid gap-3 sm:grid-cols-2">
						{org.archivedTeams.map((team) => (
							<TeamCard
								key={team.id}
								team={team}
								orgId={org.id}
								href={appRoutes.teams.byId(team.id)}
							/>
						))}
					</div>
				</PageSection>
			)}
		</PageContainer>
	);
}
