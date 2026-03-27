import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

interface TeamPlayersPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamPlayersPage({ params }: TeamPlayersPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	const canManage = team.currentUser.canManage;
	const canManageAdmins = team.currentUser.canManageAdmins;

	return (
		<PageContainer>
			<PageHeader
				title="Players"
				description="Manage rostered players, their roles, and invite new players into the team."
				actions={
					canManage ? (
						<InvitePlayerDialog
							teamId={team.id}
							canManageAdmins={canManageAdmins}
							defaultMemberType="player"
							title="Invite player"
						>
							<Button size="sm">
								<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Invite player
							</Button>
						</InvitePlayerDialog>
					) : undefined
				}
			/>
			<RosterTable
				roster={team.players}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.id}
				emptyLabel="No players on this team yet"
				emptyDescription="Invite players to start building the roster."
			/>
		</PageContainer>
	);
}
