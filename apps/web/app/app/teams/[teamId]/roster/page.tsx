import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
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
	const summaryPillClass =
		"inline-flex h-7 items-center border px-3 text-xs font-medium transition-colors";
	const activeSummaryPillClass = "border-foreground text-foreground";
	const inactiveSummaryPillClass =
		"border-border text-muted-foreground hover:border-foreground hover:text-foreground";

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

			<div className="flex flex-wrap items-center gap-2">
				<Link href={`${appRoutes.teams.roster(team.data.id)}?type=players`}>
					<span
						className={cn(
							summaryPillClass,
							!isStaffTab ? activeSummaryPillClass : inactiveSummaryPillClass
						)}
					>
						Players: {activePlayers} active
					</span>
				</Link>
				<Link href={`${appRoutes.teams.roster(team.data.id)}?type=staff`}>
					<span
						className={cn(
							summaryPillClass,
							isStaffTab ? activeSummaryPillClass : inactiveSummaryPillClass
						)}
					>
						Staff: {activeStaff} active
					</span>
				</Link>
				<span className={cn(summaryPillClass, "border-border text-muted-foreground")}>
					Admins: {team.data.adminCount}
				</span>
				<span className={cn(summaryPillClass, "border-border text-muted-foreground")}>
					Pending invites: {team.data.pendingInvites.length}
				</span>
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
