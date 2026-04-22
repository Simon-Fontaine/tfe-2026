import { OrgWorkspaceMissingState } from "@/components/orgs/org-workspace-state";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { StatsGrid } from "@/components/workspace/stats-grid";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

export default async function AppOrgOverviewPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) return <OrgWorkspaceMissingState />;

	const totalTeams = org.activeTeams.length + org.archivedTeams.length;
	const openListingCount = org.ownedListings.filter((post) => post.status === "open").length;

	return (
		<PageContainer>
			<PageHeader
				title={org.name}
				description={org.description || `/${org.slug}`}
				badge={
					<Badge variant="outline" className="text-[10px]">
						{ROLE_LABELS[org.currentUser.role ?? "member"] ?? org.currentUser.role}
					</Badge>
				}
				actions={
					org.currentUser.canManage ? <CreateTeamDialog orgId={org.id} showTrigger /> : undefined
				}
			>
				<div className="flex items-center gap-3 pt-1">
					<Avatar className="size-10 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-xs font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<p className="text-xs text-muted-foreground">/{org.slug}</p>
				</div>
			</PageHeader>

			<StatsGrid
				stats={[
					{ label: "Teams", value: totalTeams },
					{ label: "Members", value: org.members.length },
					{ label: "Open listings", value: openListingCount },
					{ label: "Pending invites", value: org.pendingInvites.length },
				]}
			/>

			<PageSection
				title="Active teams"
				description="Your active rosters and their current competitive footprint."
			>
				{org.activeTeams.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No active teams yet. Create a team to start organizing scrims and recruiting.
					</p>
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
		</PageContainer>
	);
}
