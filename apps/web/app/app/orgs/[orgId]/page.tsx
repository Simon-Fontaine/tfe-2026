import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { AttentionQueue, type AttentionQueueItem } from "@/components/workspace/attention-queue";
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
		return <AccessGate title="Organization" resourceType="organization" />;
	}
	const orgDetail = org.data;

	const totalTeams = orgDetail.activeTeams.length + orgDetail.archivedTeams.length;
	const openListingCount = orgDetail.ownedListings.filter((post) => post.status === "open").length;
	const attentionItems: AttentionQueueItem[] = orgDetail.activeTeams
		.flatMap((team) =>
			(team.oversight?.signals ?? [])
				.filter((signal) => signal.severity === "critical" || signal.severity === "warning")
				.slice(0, 2)
				.map((signal) => ({
					id: `${team.id}-${signal.code}`,
					title: `${team.name}: ${signal.label}`,
					objectType: "team oversight",
					contextLabel: orgDetail.name,
					statusText: signal.severity === "critical" ? "Needs action" : "Watch",
					timestamp: signal.at ?? team.oversight?.latestActivityAt ?? null,
					priority: signal.severity === "critical" ? 1 : 2,
					actionLabel: team.oversight?.canOpenWorkspace ? "Open team" : "View teams",
					href: team.oversight?.canOpenWorkspace
						? appRoutes.teams.byId(team.id)
						: appRoutes.orgs.teams(orgDetail.id),
					prefetch: false,
					permissionCopy: team.oversight?.autonomyCopy,
				}))
		)
		.slice(0, 12);

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
				title="Operational attention"
				description="Permission-filtered team health signals for organization coordination."
			>
				<AttentionQueue items={attentionItems} />
			</PageSection>

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
