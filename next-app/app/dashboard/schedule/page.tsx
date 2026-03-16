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
		return <ScheduleNoTeams />;
	}

	// Use the URL param if it resolves to one of the user's teams, otherwise default to first.
	const activeTeam = teams.find((t) => t.id === team) ?? teams[0];
	const availability = await getPlayerAvailability(user.id, activeTeam.id);

	return <ScheduleGrid availability={availability} teams={teams} activeTeam={activeTeam} />;
}
