import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
		return <AccessGate title="Roster" resourceType="team" />;
	}
	if (!team.data.currentUser.canViewRoster) {
		return <AccessGate title="Roster" resourceType="team" />;
	}

	const activeTab = type === "staff" ? "staff" : "players";
	const canManage = team.data.currentUser.canManage;
	const canManageAdmins = team.data.currentUser.canManageAdmins;
	const canManageInvites = team.data.currentUser.canManageInvites;
	const isStaffTab = activeTab === "staff";
	const activeRoster = isStaffTab ? team.data.staff : team.data.players;
	const activePlayers = team.data.players.filter((member) => member.status !== "inactive").length;
	const activeStaff = team.data.staff.filter((member) => member.status !== "inactive").length;

	return (
		<PageContainer>
			<PageHeader
				title="Roster"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(team.data.id)} className="hover:underline">
							{team.data.name}
						</Link>
						{" / Roster"}
					</>
				}
				action={
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

			<div className="flex flex-wrap gap-2">
				<Link href={`${appRoutes.teams.roster(team.data.id)}?type=players`}>
					<Badge
						variant="outline"
						className={cn(!isStaffTab && "border-foreground text-foreground")}
					>
						Players: {activePlayers} active
					</Badge>
				</Link>
				<Link href={`${appRoutes.teams.roster(team.data.id)}?type=staff`}>
					<Badge
						variant="outline"
						className={cn(isStaffTab && "border-foreground text-foreground")}
					>
						Staff: {activeStaff} active
					</Badge>
				</Link>
				<Badge variant="outline">Admins: {team.data.adminCount}</Badge>
				<Badge variant="outline">Pending invites: {team.data.pendingInvites.length}</Badge>
			</div>

			<RosterTable
				roster={activeRoster}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.data.id}
			/>

			{canManageInvites ? (
				<PageSection title="Pending invites">
					<TeamInvitesSection teamId={team.data.id} invites={team.data.pendingInvites} />
				</PageSection>
			) : null}
		</PageContainer>
	);
}
