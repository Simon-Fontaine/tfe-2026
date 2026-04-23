import { redirect } from "next/navigation";
import { ScheduleNoTeams } from "@/components/schedule/schedule-no-teams";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getActiveTeamsForUser } from "@/lib/data/player";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppCalendarPage() {
	const { user } = await requireWorkspaceSession();

	const teams = await getActiveTeamsForUser(user.id);
	if (teams.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					title="Calendar"
					description="Team schedule is available once you join a team."
				/>
				<ScheduleNoTeams />
			</PageContainer>
		);
	}

	redirect(appRoutes.teams.calendar(teams[0].id));
}
