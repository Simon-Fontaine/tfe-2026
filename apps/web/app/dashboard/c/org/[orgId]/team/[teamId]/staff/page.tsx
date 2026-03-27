import { Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddPlayerDialog } from "@/components/teams/add-player-dialog";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RosterTable } from "@/components/teams/roster-table";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

interface TeamStaffPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamStaffPage({ params }: TeamStaffPageProps) {
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
				title="Staff"
				description="Manage coaches, analysts, and managers through the same team membership model."
				actions={
					canManage ? (
						<>
							<InvitePlayerDialog
								teamId={team.id}
								canManageAdmins={canManageAdmins}
								defaultMemberType="staff"
								title="Invite staff"
							>
								<Button size="sm" variant="outline">
									<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									Invite
								</Button>
							</InvitePlayerDialog>
							<AddPlayerDialog
								teamId={team.id}
								canManageAdmins={canManageAdmins}
								defaultMemberType="staff"
								title="Add staff"
							>
								<Button size="sm">
									<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									Add staff
								</Button>
							</AddPlayerDialog>
						</>
					) : undefined
				}
			/>
			<RosterTable
				roster={team.staff}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.id}
				emptyLabel="No staff members on this team yet."
			/>
		</PageContainer>
	);
}
