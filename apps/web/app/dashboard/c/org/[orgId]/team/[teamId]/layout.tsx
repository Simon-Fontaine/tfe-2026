import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

export default async function TeamLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ orgId: string; teamId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	return <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">{children}</div>;
}
