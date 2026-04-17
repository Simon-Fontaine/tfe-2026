import { notFound } from "next/navigation";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { TeamScheduleBoard } from "@/components/schedule/team/team-schedule-board";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlayerAvailability } from "@/lib/data/player";
import { getTeamSchedule, getTeamWithRoster } from "@/lib/data/teams";

export default async function AppTeamCalendarPage({
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

	if (!team) notFound();
	if (!schedule) {
		return (
			<PageContainer>
				<PageHeader
					title="Calendar"
					description="Team-wide availability, planning, and scheduling windows."
				/>
				<EmptyStateBlock
					title="Calendar unavailable"
					description="You must be an active team member to view this team's shared availability."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const teamOption = { id: team.id, name: team.name, tag: team.tag };

	return (
		<PageContainer>
			<PageHeader
				title="Calendar"
				description="Team-wide availability with quick personal editing for recurring and one-off windows."
			/>
			<div className="space-y-6">
				<TeamScheduleBoard schedule={schedule} currentUserId={user.id} />
				<ScheduleGrid availability={myAvailability} teams={[teamOption]} activeTeam={teamOption} />
			</div>
		</PageContainer>
	);
}
