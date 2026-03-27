import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { ScheduleNoTeams } from "@/components/schedule/schedule-no-teams";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveTeamsForUser, getPlayerAvailability } from "@/lib/data/player";

export default async function SchedulePage({
	searchParams,
}: {
	searchParams: Promise<{ team?: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { team } = await searchParams;
	const teams = await getActiveTeamsForUser(user.id);

	if (teams.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					title="Schedule"
					description="Set your recurring availability and one-off dates for scrim scheduling"
				/>
				<ScheduleNoTeams />
			</PageContainer>
		);
	}

	const activeTeam = teams.find((t) => t.id === team) ?? teams[0];
	const availability = await getPlayerAvailability(user.id, activeTeam.id);

	return (
		<PageContainer>
			<PageHeader
				title="Schedule"
				description="Set your recurring availability and one-off dates for scrim scheduling"
			/>
			<ScheduleGrid availability={availability} teams={teams} activeTeam={activeTeam} />
		</PageContainer>
	);
}
