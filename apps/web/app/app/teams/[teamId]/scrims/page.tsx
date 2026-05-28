import {
	Add01Icon,
	Calendar03Icon,
	Image01Icon,
	LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateScrimDialog } from "@/components/scrims/create-scrim-dialog";
import { ScrimStatusBadge } from "@/components/scrims/scrim-status-badge";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
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

function isNeedsAction(scrim: ScrimSummary, teamId: string, canResolveDispute: boolean): boolean {
	if (scrim.status === "awaiting_confirmation") return true;
	if (scrim.status === "pending" && scrim.awayTeam?.id === teamId) return true;
	if (scrim.status === "disputed" && canResolveDispute) return true;
	return false;
}

function ScrimRow({ scrim, teamId }: { scrim: ScrimSummary; teamId: string }) {
	const opponentDisplay = getOpponentDisplay(scrim, teamId);
	const pendingSteps = scrim.pendingConfirmationCount;

	return (
		<div className="border p-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold">
							{opponentDisplay.label}
							{opponentDisplay.isArchived && (
								<span className="ml-1.5 text-xs font-normal text-muted-foreground">(archived)</span>
							)}
						</p>
						<ScrimStatusBadge status={scrim.status} disputeResolution={scrim.disputeResolution} />
					</div>
					<p className="text-xs text-muted-foreground">
						{scrim.message ?? "No manager note added yet."}
					</p>
				</div>

				<div className="grid gap-2 text-xs text-muted-foreground md:min-w-64">
					<div className="flex items-center gap-2">
						<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
						<span>{formatScheduledAt(scrim.scheduledAt)}</span>
					</div>
					<div className="flex items-center gap-2">
						<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
						<span>
							Series score {scrim.homeMapScore} - {scrim.awayMapScore}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-3.5" />
						<span>{pendingSteps} confirmation step(s) still open</span>
					</div>
				</div>
			</div>

			<div className="mt-4 flex justify-end">
				<Button asChild size="sm" variant="outline">
					<Link href={appRoutes.teams.scrimById(teamId, scrim.id)}>Open scrim workspace</Link>
				</Button>
			</div>
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
					detail={`[${team.data.tag}] ${team.data.name}`}
					description={`Live scrim queue, result confirmation, and evidence tracking for ${team.data.name}.`}
				/>
				<EmptyStateBlock
					title={scrimsState.kind === "no-access" ? "No access" : "Scrims unavailable"}
					description={
						scrimsState.kind === "no-access"
							? "You do not have permission to view this team's scrim queue."
							: "This team's scrim queue could not be opened from the current route."
					}
					variant="card"
				/>
			</PageContainer>
		);
	}

	const teamData = team.data;
	const { scrims, nextCursor } = scrimsState.data;
	const canResolveDispute =
		teamData.currentUser.orgRole === "owner" || teamData.currentUser.orgRole === "admin";

	const needsActionScrims = scrims.filter((s) => isNeedsAction(s, teamData.id, canResolveDispute));
	const upcomingScrims = scrims.filter(
		(s) =>
			!isNeedsAction(s, teamData.id, canResolveDispute) &&
			["accepted", "scheduled", "in_progress"].includes(s.status)
	);
	const pastScrims = scrims.filter(
		(s) =>
			!isNeedsAction(s, teamData.id, canResolveDispute) &&
			["completed", "cancelled", "disputed"].includes(s.status)
	);
	const needsActionCount = needsActionScrims.length;

	const createAction = teamData.currentUser.canManage ? (
		opponentOptions.length > 0 ? (
			<CreateScrimDialog teamId={teamData.id} opponentOptions={opponentOptions}>
				<Button size="sm">
					<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
					New scrim
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
				description={`Live scrim queue, result confirmation, and evidence tracking for ${teamData.name}.`}
				actions={createAction}
			/>

			<ScrimsStoreBootstrap teamId={teamData.id} needsActionCount={needsActionCount} />

			{scrims.length === 0 ? (
				<>
					<EmptyStateBlock
						icon={Calendar03Icon}
						title="No scrims scheduled"
						description="Scrim requests and scheduled matches will appear here once your team is active."
						variant="card"
					/>
					{!teamData.currentUser.canManage && (
						<p className="text-center text-sm text-muted-foreground">
							Team managers can schedule scrims from this page.
						</p>
					)}
				</>
			) : (
				<div className="space-y-6">
					<PageSection
						title="Needs action"
						actions={
							needsActionCount > 0 ? (
								<Badge variant="default">
									{needsActionCount} {needsActionCount === 1 ? "scrim" : "scrims"}
								</Badge>
							) : (
								<Badge variant="outline">0 scrims</Badge>
							)
						}
					>
						{needsActionScrims.length === 0 ? (
							<EmptyStateBlock
								title="Nothing needs attention"
								description="Scrims waiting for your response or confirmation will appear here."
								variant="inline"
							/>
						) : (
							<div className="space-y-3">
								{needsActionScrims.map((scrim) => (
									<ScrimRow key={scrim.id} scrim={scrim} teamId={teamData.id} />
								))}
							</div>
						)}
					</PageSection>

					<PageSection
						title="Upcoming"
						actions={
							<Badge variant="outline">
								{upcomingScrims.length} {upcomingScrims.length === 1 ? "scrim" : "scrims"}
							</Badge>
						}
					>
						{upcomingScrims.length === 0 ? (
							<EmptyStateBlock
								title="No upcoming scrims"
								description="Accepted and scheduled scrims will appear here."
								variant="inline"
							/>
						) : (
							<div className="space-y-3">
								{upcomingScrims.map((scrim) => (
									<ScrimRow key={scrim.id} scrim={scrim} teamId={teamData.id} />
								))}
							</div>
						)}
					</PageSection>

					<PageSection
						title="Past"
						actions={
							<Badge variant="outline">
								{pastScrims.length} {pastScrims.length === 1 ? "scrim" : "scrims"}
							</Badge>
						}
					>
						{pastScrims.length === 0 ? (
							<EmptyStateBlock
								title="No completed scrims yet"
								description="Finished, cancelled, and disputed scrims will appear here."
								variant="inline"
							/>
						) : (
							<div className="space-y-3">
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
					</PageSection>
				</div>
			)}
		</PageContainer>
	);
}
