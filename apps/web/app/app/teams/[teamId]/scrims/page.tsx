import { Add01Icon, Calendar03Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateScrimDialog } from "@/components/scrims/create-scrim-dialog";
import { ScrimStatusBadge } from "@/components/scrims/scrim-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { getTeamsForDiscovery } from "@/lib/data/discovery";
import { getTeamScrimsRouteState, type ScrimSummary } from "@/lib/data/scrims";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";
import { ScrimsStoreBootstrap } from "./scrims-store-bootstrap";

function formatScheduledAt(value: string | null) {
	if (!value) return "Scheduling in progress";
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getOpponentDisplay(
	scrim: ScrimSummary,
	teamId: string
): { label: string; isArchived: boolean } {
	const isHome = scrim.homeTeam.id === teamId;
	const opponent = isHome ? scrim.awayTeam : scrim.homeTeam;
	const snapshot = isHome ? scrim.awayTeamSnapshot : scrim.homeTeamSnapshot;

	if (!opponent) {
		return {
			label: snapshot ? `[${snapshot.tag}] ${snapshot.name}` : "Open opponent slot",
			isArchived: false,
		};
	}
	if (snapshot) {
		return { label: `[${snapshot.tag}] ${snapshot.name}`, isArchived: opponent.isArchived };
	}
	return { label: `[${opponent.tag}] ${opponent.name}`, isArchived: opponent.isArchived };
}

function isNeedsAction(scrim: ScrimSummary, teamId: string): boolean {
	if (scrim.status === "awaiting_confirmation") return true;
	if (scrim.status === "pending" && scrim.awayTeam?.id === teamId) return true;
	if (scrim.status === "disputed") return true;
	return false;
}

function ScrimRow({ scrim, teamId }: { scrim: ScrimSummary; teamId: string }) {
	const opponentDisplay = getOpponentDisplay(scrim, teamId);

	return (
		<div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b py-2 text-sm">
			<div className="min-w-0">
				<span className="truncate font-medium">
					{opponentDisplay.label}
					{opponentDisplay.isArchived && (
						<span className="ml-1.5 text-xs text-muted-foreground">(archived)</span>
					)}
				</span>
			</div>
			<ScrimStatusBadge status={scrim.status} disputeResolution={scrim.disputeResolution} />
			<span className="whitespace-nowrap text-xs text-muted-foreground">
				{formatScheduledAt(scrim.scheduledAt)}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon" variant="ghost" className="size-8">
						<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link href={appRoutes.teams.scrimById(teamId, scrim.id)}>Open scrim workspace</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export default async function TeamScrimsPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ pastCursor?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const { pastCursor } = await searchParams;
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success" || !team.data.currentUser.canViewScrims) {
		return <AccessGate title="Scrims" resourceType="team" />;
	}

	const [scrimsState, discoveryTeams] = await Promise.all([
		getTeamScrimsRouteState(teamId, pastCursor),
		team.data.currentUser.canManage ? getTeamsForDiscovery() : Promise.resolve([]),
	]);
	const opponentOptions = discoveryTeams.filter((candidate) => candidate.id !== team.data.id);

	if (scrimsState.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Scrims"
					breadcrumbs={
						<>
							<Link href="/app" className="hover:underline">
								Teams
							</Link>
							{" / "}
							<Link href={appRoutes.teams.byId(teamId)} className="hover:underline">
								{team.data.name}
							</Link>
							{" / Scrims"}
						</>
					}
				/>
				<EmptyState
					icon={Calendar03Icon}
					title={scrimsState.kind === "no-access" ? "No access." : "Scrims unavailable."}
				/>
			</PageContainer>
		);
	}

	const teamData = team.data;
	const { scrims, nextCursor } = scrimsState.data;

	const needsActionScrims = scrims.filter((s) => isNeedsAction(s, teamData.id));
	const upcomingScrims = scrims.filter(
		(s) =>
			!isNeedsAction(s, teamData.id) && ["accepted", "scheduled", "in_progress"].includes(s.status)
	);
	const pastScrims = scrims.filter(
		(s) => !isNeedsAction(s, teamData.id) && ["completed", "cancelled"].includes(s.status)
	);
	const needsActionCount = needsActionScrims.length;

	const createAction = teamData.currentUser.canManage ? (
		opponentOptions.length > 0 ? (
			<CreateScrimDialog teamId={teamData.id} opponentOptions={opponentOptions}>
				<Button size="sm">
					<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
					Schedule Scrim
				</Button>
			</CreateScrimDialog>
		) : (
			<Button size="sm" disabled>
				<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
				No opponent teams
			</Button>
		)
	) : undefined;

	return (
		<PageContainer>
			<PageHeader
				title="Scrims"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(teamData.id)} className="hover:underline">
							{teamData.name}
						</Link>
						{" / Scrims"}
					</>
				}
				action={createAction}
			/>

			<ScrimsStoreBootstrap teamId={teamData.id} needsActionCount={needsActionCount} />

			{scrims.length === 0 ? (
				<EmptyState icon={Calendar03Icon} title="No scrims scheduled." action={createAction} />
			) : (
				<div className="space-y-6">
					<section>
						<div className="mb-4 flex items-center justify-between border-b pb-2">
							<h2 className="text-lg font-semibold">Needs action</h2>
							<Badge
								variant="outline"
								className={needsActionCount > 0 ? "border-foreground text-foreground" : ""}
							>
								{needsActionCount} {needsActionCount === 1 ? "scrim" : "scrims"}
							</Badge>
						</div>
						{needsActionScrims.length === 0 ? (
							<div className="py-8 text-center text-sm text-muted-foreground">
								Nothing needs attention.
							</div>
						) : (
							<div>
								{needsActionScrims.map((scrim) => (
									<ScrimRow key={scrim.id} scrim={scrim} teamId={teamData.id} />
								))}
							</div>
						)}
					</section>

					<section>
						<div className="mb-4 flex items-center justify-between border-b pb-2">
							<h2 className="text-lg font-semibold">Upcoming</h2>
							<Badge variant="outline">
								{upcomingScrims.length} {upcomingScrims.length === 1 ? "scrim" : "scrims"}
							</Badge>
						</div>
						{upcomingScrims.length === 0 ? (
							<div className="py-8 text-center text-sm text-muted-foreground">
								No upcoming scrims.
							</div>
						) : (
							<div>
								{upcomingScrims.map((scrim) => (
									<ScrimRow key={scrim.id} scrim={scrim} teamId={teamData.id} />
								))}
							</div>
						)}
					</section>

					<section>
						<div className="mb-4 flex items-center justify-between border-b pb-2">
							<h2 className="text-lg font-semibold">Past</h2>
							<Badge variant="outline">
								{pastScrims.length} {pastScrims.length === 1 ? "scrim" : "scrims"}
							</Badge>
						</div>
						{pastScrims.length === 0 ? (
							<div className="py-8 text-center text-sm text-muted-foreground">
								No completed scrims yet.
							</div>
						) : (
							<div>
								{pastScrims.map((scrim) => (
									<ScrimRow key={scrim.id} scrim={scrim} teamId={teamData.id} />
								))}
								{nextCursor && (
									<LoadMoreButton
										nextCursor={nextCursor}
										cursorParam="pastCursor"
										label="Load more past scrims"
									/>
								)}
							</div>
						)}
					</section>
				</div>
			)}
		</PageContainer>
	);
}
