import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";

export default async function AppTeamRosterPage({
	searchParams,
	params,
}: {
	searchParams: Promise<{ type?: string }>;
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const [{ type }, { teamId }] = await Promise.all([searchParams, params]);
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	const activeTab = type === "staff" ? "staff" : "players";
	const canManage = team.currentUser.canManage;
	const canManageAdmins = team.currentUser.canManageAdmins;
	const canManageInvites = team.currentUser.canManageInvites;
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
							teamId={team.id}
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
				description="Players and staff are managed from one team roster surface."
			>
				<div className="flex gap-2">
					<Link href={`${appRoutes.teams.roster(team.id)}?type=players`}>
						<Badge variant={!isStaffTab ? "default" : "outline"}>Players</Badge>
					</Link>
					<Link href={`${appRoutes.teams.roster(team.id)}?type=staff`}>
						<Badge variant={isStaffTab ? "default" : "outline"}>Staff</Badge>
					</Link>
				</div>
			</PageSection>

			<RosterTable
				roster={isStaffTab ? team.staff : team.players}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.id}
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
					description="All outstanding team invites now live alongside the roster they will affect."
				>
					<TeamInvitesSection teamId={team.id} invites={team.pendingInvites} />
				</PageSection>
			) : null}
		</PageContainer>
	);
}
