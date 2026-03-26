import { notFound } from "next/navigation";

import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

interface TeamSettingsPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamSettingsPage({ params }: TeamSettingsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	if (!team.currentUser.canManage && !team.currentUser.canLeave) {
		return (
			<div className="border border-dashed px-6 py-10 text-center">
				<p className="text-sm font-medium">No access</p>
				<p className="mt-1 text-xs text-muted-foreground">
					You don&apos;t have permission to manage this team&apos;s settings.
				</p>
			</div>
		);
	}

	return (
		<>
			<div>
				<h1 className="text-lg font-bold">Settings</h1>
				<p className="text-xs text-muted-foreground">
					Manage team profile, recruiting status, and danger zone actions.
				</p>
			</div>
			<TeamSettingsPanel team={team} />
		</>
	);
}
