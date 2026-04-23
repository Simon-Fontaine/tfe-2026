import { redirect } from "next/navigation";
import { getOrgsForUser } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppHomePage() {
	const { user } = await requireWorkspaceSession();

	const orgs = await getOrgsForUser(user.id);
	const firstTeam = orgs
		.flatMap((org) => org.teams)
		.sort((a, b) => a.name.localeCompare(b.name))[0];

	if (firstTeam) {
		redirect(appRoutes.teams.byId(firstTeam.id));
	}

	redirect(appRoutes.me);
}
