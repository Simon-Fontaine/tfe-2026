import { Megaphone01Icon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamUpdatesPageClient } from "@/components/updates/team-updates-page-client";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { getTeamUpdatesRouteState } from "@/lib/data/updates";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamUpdatesPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ cursor?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const { cursor } = await searchParams;
	const team = await getTeamWithRosterRouteState(teamId, user.id);

	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return <AccessGate title="Updates" resourceType="team" />;
	}
	if (!team.data.currentUser.canViewUpdates) {
		return <AccessGate title="Updates" resourceType="team" />;
	}

	const updates = await getTeamUpdatesRouteState(teamId, cursor);
	if (updates.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Updates"
					breadcrumbs={
						<>
							<Link href="/app" className="hover:underline">
								Teams
							</Link>
							{" / "}
							<Link href={appRoutes.teams.byId(team.data.id)} className="hover:underline">
								{team.data.name}
							</Link>
							{" / Updates"}
						</>
					}
				/>
				<EmptyState
					icon={Megaphone01Icon}
					title={updates.kind === "no-access" ? "No access." : "Updates unavailable."}
				/>
			</PageContainer>
		);
	}

	const { posts, nextCursor } = updates.data;

	return (
		<PageContainer>
			<PageHeader
				title="Updates"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(team.data.id)} className="hover:underline">
							{team.data.name}
						</Link>
						{" / Updates"}
					</>
				}
			/>

			<TeamUpdatesPageClient
				teamId={team.data.id}
				canManage={team.data.currentUser.canManage}
				initialUpdates={posts}
			/>
			{nextCursor && <LoadMoreButton nextCursor={nextCursor} />}
		</PageContainer>
	);
}
