import { notFound } from "next/navigation";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { TeamScheduleBoard } from "@/components/schedule/team/team-schedule-board";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getPlayerAvailability } from "@/lib/data/player";
import { getTeamScheduleRouteState, getTeamWithRosterRouteState } from "@/lib/data/teams";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppTeamCalendarPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const [team, schedule, myAvailability] = await Promise.all([
		getTeamWithRosterRouteState(teamId, user.id),
		getTeamScheduleRouteState(teamId),
		getPlayerAvailability(user.id, teamId),
	]);

	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Team schedule"
					detail={`Team ${teamId}`}
					description="Team-wide availability, planning, and scheduling windows."
				/>
				<EmptyStateBlock
					title="No access"
					description="You need an active team membership before you can open this calendar workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (schedule.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Team schedule"
					detail={`[${team.data.tag}] ${team.data.name}`}
					description="Team-wide availability, planning, and scheduling windows."
				/>
				<EmptyStateBlock
					title={schedule.kind === "no-access" ? "No access" : "Calendar unavailable"}
					description={
						schedule.kind === "no-access"
							? "You do not have permission to view this team's shared availability."
							: "This team's calendar could not be opened from the current route."
					}
					variant="card"
				/>
			</PageContainer>
		);
	}

	const teamOption = { id: team.data.id, name: team.data.name, tag: team.data.tag };

	return (
		<PageContainer>
			<PageHeader
				title="Team schedule"
				detail={`[${team.data.tag}] ${team.data.name}`}
				description="Team-wide availability with quick personal editing for recurring and one-off windows."
			/>
			<div className="space-y-6">
				<TeamScheduleBoard schedule={schedule.data} currentUserId={user.id} />
				<ScheduleGrid availability={myAvailability} teams={[teamOption]} activeTeam={teamOption} />
			</div>
		</PageContainer>
	);
}
