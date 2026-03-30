import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { apiGet } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { getOrgsForUser } from "@/lib/data/organization";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");
	if (user.registered2FA && !session.twoFactorVerified) redirect("/auth");

	const profileRes = await apiGet<{ exists: boolean }>("/api/profile/exists");
	if (!("data" in profileRes) || !profileRes.data.exists) redirect("/onboarding");

	const deletionRes = await apiGet<{ isPending: boolean }>("/api/settings/account/deletion");
	if ("data" in deletionRes && deletionRes.data.isPending) redirect("/deletion-pending");

	const unreadCount = await getUnreadNotificationCount(user.id);
	const orgs = await getOrgsForUser(user.id);

	const contextOrgs = orgs.map((org) => ({ id: org.id, name: org.name, canManage: org.canManage }));
	const contextTeams = orgs
		.flatMap((org) =>
			org.teams.map((team) => ({
				id: team.id,
				name: team.name,
				tag: team.tag,
				organizationId: org.id,
				organizationName: org.name,
				canManage: team.canManage,
			}))
		)
		.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<DashboardShell
			user={user}
			unreadCount={unreadCount}
			contextOrgs={contextOrgs}
			contextTeams={contextTeams}
		>
			{children}
		</DashboardShell>
	);
}
