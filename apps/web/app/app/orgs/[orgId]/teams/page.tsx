import { MoreHorizontalIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgWithTeamsRouteState, type OrgTeamSummary } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function TeamRows({
	teams,
	emptyTitle,
	archived = false,
}: {
	teams: OrgTeamSummary[];
	emptyTitle: string;
	archived?: boolean;
}) {
	if (teams.length === 0) {
		return <EmptyState icon={UserGroupIcon} title={emptyTitle} />;
	}

	return (
		<div className="overflow-hidden border">
			<div className="grid grid-cols-[minmax(13rem,1.6fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
				<span>Team</span>
				<span>Rating</span>
				<span>Roster</span>
				<span>Scrims</span>
				<span>Status</span>
				<span className="text-right">Actions</span>
			</div>
			<div className="divide-y">
				{teams.map((team) => {
					const canOpenWorkspace = team.oversight?.canOpenWorkspace ?? false;
					const activeRosterCount = team.oversight?.activeRosterCount ?? team.activeRosterCount;
					const upcomingScrimCount = team.oversight?.upcomingScrimCount ?? 0;
					const visibility = team.oversight?.visibility === "private" ? "Private" : "Public";

					return (
						<div
							key={team.id}
							className="grid grid-cols-[minmax(13rem,1.6fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 px-4 py-3 text-sm"
						>
							<div className="min-w-0">
								{canOpenWorkspace ? (
									<Link
										href={appRoutes.teams.byId(team.id)}
										className="block truncate font-medium hover:underline"
									>
										{team.name}
									</Link>
								) : (
									<p className="truncate font-medium">{team.name}</p>
								)}
								<p className="text-xs text-muted-foreground">{team.tag}</p>
								{!canOpenWorkspace && team.oversight?.autonomyCopy ? (
									<p className="mt-1 text-xs text-muted-foreground">
										{team.oversight.autonomyCopy}
									</p>
								) : null}
							</div>
							<span>{team.rating}</span>
							<span>{activeRosterCount} active</span>
							<span>{upcomingScrimCount} upcoming</span>
							<span className="flex flex-wrap gap-1">
								<Badge variant="outline">{archived ? "Archived" : "Active"}</Badge>
								<Badge variant="outline">{visibility}</Badge>
							</span>
							<div className="flex justify-end">
								{canOpenWorkspace ? (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button size="icon-sm" variant="ghost" aria-label="Team actions">
												<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem asChild>
												<Link href={appRoutes.teams.byId(team.id)}>Open team</Link>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default async function AppOrgTeamsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return <AccessGate title="Teams" resourceType="organization" />;
	}
	const orgDetail = org.data;

	return (
		<PageContainer>
			<PageHeader
				title="Teams"
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						<Link href={appRoutes.orgs.byId(orgDetail.id)} className="hover:underline">
							{orgDetail.name}
						</Link>
						{" / Teams"}
					</>
				}
				meta={`/${orgDetail.slug} - ${orgDetail.activeTeams.length} active teams - ${orgDetail.archivedTeams.length} archived teams - ${orgDetail.members.length} members`}
				action={
					orgDetail.currentUser.canManage ? (
						<CreateTeamDialog orgId={orgDetail.id} showTrigger />
					) : undefined
				}
			/>

			<section className="flex flex-col gap-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Active teams</h2>
				<TeamRows teams={orgDetail.activeTeams} emptyTitle="No active teams" />
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Archived teams</h2>
				<TeamRows teams={orgDetail.archivedTeams} emptyTitle="No archived teams" archived />
			</section>
		</PageContainer>
	);
}
