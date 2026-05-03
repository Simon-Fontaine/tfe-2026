import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppTeamRosterPage({
	searchParams,
	params,
}: {
	searchParams: Promise<{ type?: string }>;
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const [{ type }, { teamId }] = await Promise.all([searchParams, params]);
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Roster"
					detail={`Team ${teamId}`}
					description="Manage rostered players, statuses, and incoming invites."
				/>
				<EmptyStateBlock
					title="No access"
					description="You are not a member of this team. Contact a team manager to request access."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const activeTab = type === "staff" ? "staff" : "players";
	const canManage = team.data.currentUser.canManage;
	const canManageAdmins = team.data.currentUser.canManageAdmins;
	const canManageInvites = team.data.currentUser.canManageInvites;
	const isStaffTab = activeTab === "staff";

	return (
		<PageContainer>
			<PageHeader
				title="Roster"
				description={
					isStaffTab
						? "Manage coaches, analysts, managers, and operational staff."
						: "Manage rostered players, statuses, and incoming invites."
				}
				actions={
					canManage ? (
						<InvitePlayerDialog
							teamId={team.data.id}
							canManageAdmins={canManageAdmins}
							defaultMemberType={isStaffTab ? "staff" : "player"}
							title={isStaffTab ? "Invite staff" : "Invite player"}
						>
							<Button size="sm">
								<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								{isStaffTab ? "Invite staff" : "Invite player"}
							</Button>
						</InvitePlayerDialog>
					) : undefined
				}
			/>

			<PageSection
				title="Roster groups"
				description="Switch between the player roster and staff group."
			>
				<div className="flex gap-2">
					<Link href={`${appRoutes.teams.roster(team.data.id)}?type=players`}>
						<Badge variant={!isStaffTab ? "default" : "outline"}>Players</Badge>
					</Link>
					<Link href={`${appRoutes.teams.roster(team.data.id)}?type=staff`}>
						<Badge variant={isStaffTab ? "default" : "outline"}>Staff</Badge>
					</Link>
				</div>
			</PageSection>

			<RosterTable
				roster={isStaffTab ? team.data.staff : team.data.players}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.data.id}
				emptyLabel={
					isStaffTab ? "No staff members on this team yet" : "No players on this team yet"
				}
				emptyDescription={
					isStaffTab
						? "Invite coaches, analysts, or managers to build out the staff group."
						: "Invite players to start building the roster."
				}
			/>

			{canManageInvites ? (
				<PageSection
					title="Pending invites"
					description="Invites that have been sent but not yet accepted or declined."
				>
					<TeamInvitesSection teamId={team.data.id} invites={team.data.pendingInvites} />
				</PageSection>
			) : null}
		</PageContainer>
	);
}
