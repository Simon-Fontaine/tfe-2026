import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { AccessGate } from "@/components/workspace/access-gate";
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
		return <AccessGate title="Teams" resourceType="organization" />;
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
					<div className="space-y-3">
						<EmptyStateBlock
							icon={UserGroupIcon}
							title="No active teams"
							description={
								orgDetail.currentUser.canManage
									? "Create the first team to start managing scrims, recruiting, and roster operations."
									: "Active teams will appear here once an organization manager creates a roster."
							}
							variant="card"
						/>
						{orgDetail.currentUser.canManage ? (
							<div className="flex justify-start">
								<CreateTeamDialog orgId={orgDetail.id} showTrigger />
							</div>
						) : null}
					</div>
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

			<PageSection
				title="Archived teams"
				description="Historic rosters retained for context and recordkeeping."
			>
				{orgDetail.archivedTeams.length === 0 ? (
					<EmptyStateBlock
						icon={UserGroupIcon}
						title="No archived teams"
						description="Retired or archived rosters will appear here after teams are closed."
						variant="card"
					/>
				) : (
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
				)}
			</PageSection>
		</PageContainer>
	);
}
