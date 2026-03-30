import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { TeamScheduleBoard } from "@/components/schedule/team/team-schedule-board";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlayerAvailability } from "@/lib/data/player";
import { getTeamSchedule, getTeamWithRoster } from "@/lib/data/teams";

export default async function TeamSchedulePage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { teamId } = await params;
	const [team, schedule, myAvailability] = await Promise.all([
		getTeamWithRoster(teamId, user.id),
		getTeamSchedule(teamId),
		getPlayerAvailability(user.id, teamId),
	]);

	if (!team) return null;

	const teamOption = { id: team.id, name: team.name, tag: team.tag };

	return (
		<PageContainer>
			<PageHeader
				title="Schedule"
				description="Team-wide availability with quick personal editing for recurring and one-off windows."
			/>
			<div className="space-y-6">
				<TeamScheduleBoard schedule={schedule} currentUserId={user.id} />
				<ScheduleGrid availability={myAvailability} teams={[teamOption]} activeTeam={teamOption} />
			</div>
		</PageContainer>
	);
}
