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
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getTeamsForDiscovery } from "@/lib/data/discovery";
import { getTeamScrims, type ScrimSummary } from "@/lib/data/scrims";
import { getTeamWithRoster } from "@/lib/data/teams";
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

function getOpponent(scrim: ScrimSummary, teamId: string) {
	return scrim.homeTeam.id === teamId ? scrim.awayTeam : scrim.homeTeam;
}

function isNeedsAction(scrim: ScrimSummary, teamId: string): boolean {
	if (scrim.status === "awaiting_confirmation") return true;
	if (scrim.status === "pending" && scrim.awayTeam?.id === teamId) return true;
	return false;
}

function renderScrimRow(scrim: ScrimSummary, teamId: string) {
	const opponent = getOpponent(scrim, teamId);
	const pendingSteps = scrim.pendingConfirmationCount;

	return (
		<div key={scrim.id} className="border p-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold">
							{opponent ? `[${opponent.tag}] ${opponent.name}` : "Open opponent slot"}
						</p>
						<ScrimStatusBadge status={scrim.status} />
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

export default async function TeamScrimsPage({ params }: { params: Promise<{ teamId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const [team, scrims, discoveryTeams] = await Promise.all([
		getTeamWithRoster(teamId, user.id),
		getTeamScrims(teamId),
		getTeamsForDiscovery(),
	]);
	if (!team) notFound();
	const opponentOptions = discoveryTeams.filter((candidate) => candidate.id !== team.id);

	const needsActionScrims = scrims.filter((s) => isNeedsAction(s, team.id));
	const upcomingScrims = scrims.filter(
		(s) =>
			!isNeedsAction(s, team.id) &&
			["accepted", "scheduled", "in_progress"].includes(s.status),
	);
	const pastScrims = scrims.filter(
		(s) =>
			!isNeedsAction(s, team.id) && ["completed", "cancelled", "disputed"].includes(s.status),
	);
	const needsActionCount = needsActionScrims.length;

	const createAction = team.currentUser.canManage ? (
		opponentOptions.length > 0 ? (
			<CreateScrimDialog teamId={team.id} opponentOptions={opponentOptions}>
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
				description={`Live scrim queue, result confirmation, and evidence tracking for ${team.name}.`}
				actions={createAction}
			/>

			<ScrimsStoreBootstrap needsActionCount={needsActionCount} />

			{scrims.length === 0 ? (
				<>
					<EmptyStateBlock
						icon={Calendar03Icon}
						title="No scrims scheduled"
						description="Scrim requests and scheduled matches will appear here once your team is active."
						variant="card"
					/>
					{!team.currentUser.canManage && (
						<p className="text-center text-sm text-muted-foreground">
							Ask a team manager to schedule your first scrim.
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
							<p className="py-4 text-center text-sm text-muted-foreground">
								Nothing needs your attention right now.
							</p>
						) : (
							<div className="space-y-3">
								{needsActionScrims.map((scrim) => renderScrimRow(scrim, team.id))}
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
							<p className="py-4 text-center text-sm text-muted-foreground">No upcoming scrims.</p>
						) : (
							<div className="space-y-3">
								{upcomingScrims.map((scrim) => renderScrimRow(scrim, team.id))}
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
							<p className="py-4 text-center text-sm text-muted-foreground">
								No completed scrims yet.
							</p>
						) : (
							<div className="space-y-3">
								{pastScrims.map((scrim) => renderScrimRow(scrim, team.id))}
							</div>
						)}
					</PageSection>
				</div>
			)}
		</PageContainer>
	);
}
