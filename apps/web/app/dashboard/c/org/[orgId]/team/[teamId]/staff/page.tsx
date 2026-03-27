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
				description="Manage coaches, analysts, and managers through the invite-based team membership model."
				actions={
					canManage ? (
						<InvitePlayerDialog
							teamId={team.id}
							canManageAdmins={canManageAdmins}
							defaultMemberType="staff"
							title="Invite staff"
						>
							<Button size="sm">
								<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Invite staff
							</Button>
						</InvitePlayerDialog>
					) : undefined
				}
			/>
			<RosterTable
				roster={team.staff}
				canManage={canManage}
				canManageAdmins={canManageAdmins}
				teamId={team.id}
				emptyLabel="No staff members on this team yet"
				emptyDescription="Invite coaches, analysts, or managers to build out the staff group."
			/>
		</PageContainer>
	);
}
