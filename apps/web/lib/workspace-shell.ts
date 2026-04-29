import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { getOrgsForUser } from "@/lib/data/orgs";
import { getMyRecruitmentListings, getRecruitmentApplicationsForListing } from "@/lib/data/recruit";
import { apiRoutes } from "@/lib/routes";

export type WorkspaceSession = Awaited<ReturnType<typeof getCurrentSession>> & {
	session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>["session"]>;
	user: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>["user"]>;
};

export async function requireWorkspaceSession(): Promise<WorkspaceSession> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");
	if (user.registered2FA && !session.twoFactorVerified) redirect("/auth");

	const profileRes = await apiGet<{ exists: boolean }>(apiRoutes.profile.exists);
	if (!("data" in profileRes) || !profileRes.data.exists) redirect("/onboarding");

	const deletionRes = await apiGet<{ isPending: boolean }>(
		apiRoutes.settings.account.deletion.root
	);
	if ("data" in deletionRes && deletionRes.data.isPending) redirect("/deletion-pending");

	return { session, user };
}

export async function getWorkspaceShellData(userId: string) {
	const unreadCount = await getUnreadNotificationCount(userId);
	const orgs = await getOrgsForUser(userId);

	const contextOrgs = orgs.map((org) => ({
		id: org.id,
		name: org.name,
		canManage: org.canManage,
	}));

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

	const myListings = await getMyRecruitmentListings();
	const applicationsByListing = await Promise.all(
		myListings.map((l) => getRecruitmentApplicationsForListing(l.id))
	);
	const pendingApplicationCount = applicationsByListing
		.flat()
		.filter((a) => a.status === "pending").length;

	return {
		unreadCount,
		contextOrgs,
		contextTeams,
		pendingApplicationCount,
	};
}
