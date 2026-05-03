import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { StatsGrid } from "@/components/workspace/stats-grid";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

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
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Organization"
					detail={`Organization ${orgId}`}
					description="Overview, roster health, and recruiting activity for this workspace."
				/>
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to open this organization workspace."
					variant="page"
				/>
			</PageContainer>
		);
	}
	const orgDetail = org.data;

	const totalTeams = orgDetail.activeTeams.length + orgDetail.archivedTeams.length;
	const openListingCount = orgDetail.ownedListings.filter((post) => post.status === "open").length;

	return (
		<PageContainer>
			<PageHeader
				title={orgDetail.name}
				detail={`/${orgDetail.slug}`}
				description={orgDetail.description || `/${orgDetail.slug}`}
				badge={
					<Badge variant="outline" className="text-[10px]">
						{ROLE_LABELS[orgDetail.currentUser.role ?? "member"] ?? orgDetail.currentUser.role}
					</Badge>
				}
				actions={
					orgDetail.currentUser.canManage ? (
						<CreateTeamDialog orgId={orgDetail.id} showTrigger />
					) : undefined
				}
			>
				<div className="flex items-center gap-3 pt-1">
					<Avatar className="size-10 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={orgDetail.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-xs font-bold">
							{orgDetail.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<p className="text-xs text-muted-foreground">/{orgDetail.slug}</p>
				</div>
			</PageHeader>

			<StatsGrid
				stats={[
					{ label: "Teams", value: totalTeams },
					{ label: "Members", value: orgDetail.members.length },
					{ label: "Open listings", value: openListingCount },
					{ label: "Pending invites", value: orgDetail.pendingInvites.length },
				]}
			/>

			<PageSection
				title="Active teams"
				description="Your active rosters and their current competitive footprint."
			>
				{orgDetail.activeTeams.length === 0 ? (
					<div className="space-y-3">
						<EmptyStateBlock
							icon={UserGroupIcon}
							title="No active teams"
							description={
								orgDetail.currentUser.canManage
									? "Create a team to start organizing scrims, recruiting, and roster work from this organization."
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
		</PageContainer>
	);
}
