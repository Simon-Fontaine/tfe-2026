import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgTeamsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Teams"
					detail={`Organization ${orgId}`}
					description="Active and archived rosters for this organization workspace."
				/>
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to open this organization teams workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}
	const orgDetail = org.data;

	return (
		<PageContainer>
			<PageHeader
				title="Teams"
				detail={`/${orgDetail.slug}`}
				description={`Manage active and archived rosters for ${orgDetail.name}.`}
				actions={
					orgDetail.currentUser.canManage ? (
						<CreateTeamDialog orgId={orgDetail.id} showTrigger />
					) : undefined
				}
			/>

			<PageSection title="Active teams" description="Current rosters that are still competing.">
				{orgDetail.activeTeams.length === 0 ? (
					<EmptyStateBlock
						title="No active teams"
						description="Create a team to get started."
						variant="card"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{orgDetail.activeTeams.map((team) => (
							<TeamCard
								key={team.id}
								team={team}
								orgId={orgDetail.id}
								href={appRoutes.teams.byId(team.id)}
							/>
						))}
					</div>
				)}
			</PageSection>

			{orgDetail.archivedTeams.length > 0 && (
				<PageSection
					title="Archived teams"
					description="Historic rosters retained for context and recordkeeping."
				>
					<div className="grid gap-3 sm:grid-cols-2">
						{orgDetail.archivedTeams.map((team) => (
							<TeamCard
								key={team.id}
								team={team}
								orgId={orgDetail.id}
								href={appRoutes.teams.byId(team.id)}
							/>
						))}
					</div>
				</PageSection>
			)}
		</PageContainer>
	);
}
