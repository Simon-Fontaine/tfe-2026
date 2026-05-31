import { TimeQuarterPassIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamOverviewHeaderActions } from "@/components/teams/team-overview-header-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { StatsGrid } from "@/components/workspace/stats-grid";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { getTeamsForDiscovery } from "@/lib/data/discovery";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function formatSignedRatingDelta(value: number) {
	if (value === 0) return "+0";
	return value > 0 ? `+${value}` : `${value}`;
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export default async function AppTeamOverviewPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return <AccessGate title="Overview" resourceType="team" />;
	}

	const canManageTeam = team.data.currentUser.canManage;
	const openListingCount = team.data.currentUser.canViewRecruiting
		? team.data.ownedListings.filter((post) => post.status === "open").length
		: 0;

	const discoveryTeams = canManageTeam ? await getTeamsForDiscovery() : [];
	const opponentOptions = discoveryTeams.filter((c) => c.id !== team.data.id);

	const headerAction = canManageTeam ? (
		<TeamOverviewHeaderActions
			teamId={team.data.id}
			canManageAdmins={team.data.currentUser.canManageAdmins}
			opponentOptions={opponentOptions}
		/>
	) : undefined;

	return (
		<PageContainer>
			<PageHeader
				title={team.data.name}
				breadcrumbs={
					<Link href="/app" className="hover:underline">
						Teams
					</Link>
				}
				meta={
					<span className="flex flex-wrap items-center gap-2">
						<span>[{team.data.tag}]</span>
						<span>Rating {team.data.rating}</span>
						<span>{team.data.matchesPlayed} scrims</span>
						{team.data.isArchived && (
							<Badge variant="outline" className="text-[10px]">
								Archived
							</Badge>
						)}
						{team.data.isRecruiting && (
							<Badge
								variant="outline"
								className={cn("text-[10px]", STATUS_BADGE_CLASSES.recruiting)}
							>
								Recruiting
							</Badge>
						)}
					</span>
				}
				action={headerAction}
			/>

			<StatsGrid
				stats={[
					{ label: "Players", value: team.data.players.length },
					{ label: "Staff", value: team.data.staff.length },
					{ label: "Pending invites", value: team.data.pendingInvites.length },
					{ label: "Open listings", value: openListingCount },
				]}
			/>

			<PageSection title="Recent rating changes">
				{team.data.ratingHistory.length === 0 ? (
					<EmptyState
						icon={TimeQuarterPassIcon}
						title="No rated scrims yet. Once completed scrims are confirmed, rating changes will appear here."
					/>
				) : (
					<div className="space-y-2">
						{team.data.ratingHistory.map((entry) => (
							<Link
								key={entry.id}
								href={appRoutes.teams.scrimById(team.data.id, entry.scrimId)}
								className="flex flex-wrap items-center justify-between gap-3 border px-3 py-3 transition-colors hover:bg-muted/50"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold">
										{entry.opponentTeamTag && entry.opponentTeamName
											? `vs [${entry.opponentTeamTag}] ${entry.opponentTeamName}`
											: "View rated scrim"}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{entry.teamMapScore} - {entry.opponentMapScore} · Rating {entry.ratingBefore} →{" "}
										{entry.ratingAfter} · {formatTimestamp(entry.createdAt)}
									</p>
								</div>
								<Badge
									variant="outline"
									className={
										entry.result === "win"
											? STATUS_BADGE_CLASSES.win
											: entry.result === "draw"
												? STATUS_BADGE_CLASSES.draw
												: STATUS_BADGE_CLASSES.loss
									}
								>
									{entry.result} {formatSignedRatingDelta(entry.ratingDelta)}
								</Badge>
							</Link>
						))}
					</div>
				)}
			</PageSection>

			<PageSection title="Team admins">
				<div className="space-y-2">
					{team.data.admins.map((admin) => (
						<div
							key={`${admin.source}-${admin.userId}`}
							className="flex items-center gap-3 border px-3 py-2"
						>
							<Avatar className="size-8 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={admin.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-[10px] font-bold">
									{admin.displayName.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<Link
									href={publicRoutes.players.byUsername(admin.username)}
									className="truncate text-xs font-medium hover:underline"
								>
									{admin.displayName}
								</Link>
								<p className="text-[11px] text-muted-foreground capitalize">
									{admin.source === "organization"
										? `${admin.orgRole} access`
										: `${admin.permissionRole} access`}
								</p>
							</div>
						</div>
					))}
				</div>
			</PageSection>
		</PageContainer>
	);
}
