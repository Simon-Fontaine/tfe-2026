import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgsForUser } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";

export default async function AppHomePage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const orgs = await getOrgsForUser(user.id);
	const firstTeam = orgs
		.flatMap((org) => org.teams)
		.sort((a, b) => a.name.localeCompare(b.name))[0];

	if (firstTeam) {
		redirect(appRoutes.teams.byId(firstTeam.id));
	}

	redirect(appRoutes.me);
}
