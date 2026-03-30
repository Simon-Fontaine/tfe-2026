import { redirect } from "next/navigation";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScheduleNoTeams } from "@/components/schedule/schedule-no-teams";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveTeamsForUser } from "@/lib/data/player";

export default async function LegacySchedulePage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const teams = await getActiveTeamsForUser(user.id);
	if (teams.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					title="Schedule"
					description="Team schedule is available once you join a team."
				/>
				<ScheduleNoTeams />
			</PageContainer>
		);
	}

	redirect(`/dashboard/teams/${teams[0].id}/schedule`);
}
