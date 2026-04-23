import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { StatsGrid } from "@/components/workspace/stats-grid";
import { getTeamWithRoster } from "@/lib/data/teams";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function formatSignedRatingDelta(value: number) {
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
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	const openListingCount = team.ownedListings.filter((post) => post.status === "open").length;

	return (
		<PageContainer>
			<PageHeader
				title={team.name}
				description={`Rating ${team.rating} · ${team.matchesPlayed} scrims played`}
				badge={
					<>
						<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
						{team.isArchived ? (
							<Badge variant="outline" className="text-[10px]">
								Archived
							</Badge>
						) : null}
						{team.isRecruiting ? (
							<Badge variant="secondary" className="text-[10px] text-green-600">
								Recruiting
							</Badge>
						) : null}
					</>
				}
			>
				{team.description ? (
					<p className="text-xs text-muted-foreground">{team.description}</p>
				) : null}
			</PageHeader>

			<StatsGrid
				stats={[
					{ label: "Players", value: team.players.length },
					{ label: "Staff", value: team.staff.length },
					{ label: "Pending invites", value: team.pendingInvites.length },
					{ label: "Open listings", value: openListingCount },
				]}
			/>

			<PageSection
				title="Recent rating changes"
				description="Ratings only change after both teams confirm the final scrim result."
			>
				{team.ratingHistory.length === 0 ? (
					<div className="border px-3 py-4">
						<p className="text-sm font-semibold">No rated scrims yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Once completed scrims are confirmed, the resulting rating changes will show up here.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{team.ratingHistory.map((entry) => (
							<Link
								key={entry.id}
								href={appRoutes.teams.scrimById(team.id, entry.scrimId)}
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
									variant={entry.result === "loss" ? "destructive" : "secondary"}
									className={
										entry.result === "win"
											? "text-green-600"
											: entry.result === "draw"
												? "border-muted-foreground/40 text-muted-foreground"
												: undefined
									}
								>
									{entry.result} {formatSignedRatingDelta(entry.ratingDelta)}
								</Badge>
							</Link>
						))}
					</div>
				)}
			</PageSection>

			<PageSection
				title="Team admins"
				description="Roster and workspace admins with the permissions to run this team day to day."
			>
				<div className="space-y-2">
					{team.admins.map((admin) => (
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
