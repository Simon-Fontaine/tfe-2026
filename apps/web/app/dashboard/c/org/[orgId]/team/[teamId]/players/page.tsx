import { Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { AddPlayerDialog } from "@/components/teams/add-player-dialog";
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
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Players</h1>
					<p className="text-xs text-muted-foreground">
						Manage rostered players, their roles, and delegated admin access.
					</p>
				</div>
				{canManage && (
					<div className="flex gap-2">
						<InvitePlayerDialog
							teamId={team.id}
							canManageAdmins={canManageAdmins}
							defaultMemberType="player"
							title="Invite player"
						>
							<Button size="sm" variant="outline">
								<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Invite
							</Button>
						</InvitePlayerDialog>
						<AddPlayerDialog
							teamId={team.id}
							canManageAdmins={canManageAdmins}
							defaultMemberType="player"
							title="Add player"
						>
							<Button size="sm">
								<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Add player
							</Button>
						</AddPlayerDialog>
					</div>
				)}
			</div>
			<RosterTable
				roster={team.players}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.id}
				emptyLabel="No players on this team yet."
			/>
		</>
	);
}
