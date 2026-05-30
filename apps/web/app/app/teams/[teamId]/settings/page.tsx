import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppTeamSettingsPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return (
			<AccessGate
				title="Settings"
				resourceType="team"
				reason={team.kind === "no-access" ? team.reason : undefined}
			/>
		);
	}

	if (!team.data.currentUser.canManageSettings && !team.data.currentUser.canLeave) {
		return <AccessGate title="Settings" resourceType="team" reason="role" />;
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(teamId)} className="hover:underline">
							{team.data.name}
						</Link>
						{" / Settings"}
					</>
				}
			/>
			<TeamSettingsPanel team={team.data} currentUserId={user.id} />
		</PageContainer>
	);
}
