import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmScrimDialog } from "@/components/scrims/confirm-scrim-dialog";
import { ReportScrimResultDialog } from "@/components/scrims/report-scrim-result-dialog";
import { ResolveScrimDisputeDialog } from "@/components/scrims/resolve-scrim-dispute-dialog";
import { ScrimConfirmationSection } from "@/components/scrims/scrim-confirmation-section";
import { ScrimMapsSection } from "@/components/scrims/scrim-maps-section";
import { ScrimOcrJobsPanel } from "@/components/scrims/scrim-ocr-jobs-panel";
import { ScrimRatingSection } from "@/components/scrims/scrim-rating-section";
import { ScrimRespondActions } from "@/components/scrims/scrim-respond-actions";
import { ScrimResultRevisions } from "@/components/scrims/scrim-result-revisions";
import { ScrimSeriesOverview } from "@/components/scrims/scrim-series-overview";
import { ScrimStatusBadge } from "@/components/scrims/scrim-status-badge";
import { UploadScrimEvidenceDialog } from "@/components/scrims/upload-scrim-evidence-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getScrimChatRouteState } from "@/lib/data/chat";
import { getScrimRouteState } from "@/lib/data/scrims";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: emptyLabel;
}

export default async function TeamScrimDetailPage({
	params,
}: {
	params: Promise<{ teamId: string; scrimId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId, scrimId } = await params;
	const [teamState, scrimState, chatConversationsState] = await Promise.all([
		getTeamWithRosterRouteState(teamId, user.id),
		getScrimRouteState(scrimId),
		getScrimChatRouteState(scrimId),
	]);

	if (teamState.kind === "missing" || scrimState.kind === "missing") notFound();
	if (teamState.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader title="Scrim detail" detail="team workspace" />
				<EmptyStateBlock
					title="No access"
					description="You need an active team membership before you can open this scrim workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}
	if (scrimState.kind === "no-access") {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					detail={`[${teamState.data.tag}] ${teamState.data.name}`}
				/>
				<EmptyStateBlock
					title="No access"
					description="This scrim belongs to a workspace you cannot review from the current team shell."
					variant="card"
				/>
			</PageContainer>
		);
	}
	if (scrimState.kind === "wrong-context") {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					detail={`[${teamState.data.tag}] ${teamState.data.name}`}
				/>
				<EmptyStateBlock
					title="Scrim belongs to another team"
					description="This scrim exists, but it is not part of the team workspace in the current URL. Return to this team's scrims and open the matching workspace entry."
					actionHref={appRoutes.teams.scrims(teamState.data.id)}
					actionLabel="Back to scrim queue"
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (chatConversationsState.kind === "missing") notFound();

	const team = teamState.data;
	const scrim = scrimState.data;
	const availableChatConversations =
		chatConversationsState.kind === "success" ? chatConversationsState.data : [];

	const currentConfirmation =
		scrim.confirmations.find(
			(confirmation: (typeof scrim.confirmations)[number]) => confirmation.teamId === team.id
		) ?? null;
	const canReportResult =
		team.currentUser.canManage &&
		!!scrim.awayTeam &&
		scrim.status !== "pending" &&
		scrim.status !== "cancelled" &&
		scrim.status !== "completed";
	const canReviewConfirmation =
		team.currentUser.canManage &&
		!!currentConfirmation &&
		(scrim.status === "awaiting_confirmation" || scrim.status === "disputed");
	const canResolveDispute =
		scrim.status === "disputed" &&
		(team.currentUser.orgRole === "owner" || team.currentUser.orgRole === "admin");
	const canUploadEvidence =
		!!scrim.awayTeam && scrim.status !== "pending" && scrim.status !== "cancelled";
	const disputeResolution =
		scrim.dispute.resolution ?? (scrim.status === "disputed" ? "pending" : null);

	const title = scrim.awayTeam
		? `[${scrim.homeTeam.tag}] ${scrim.homeTeam.name} vs [${scrim.awayTeam.tag}] ${scrim.awayTeam.name}`
		: `[${scrim.homeTeam.tag}] ${scrim.homeTeam.name} vs Open opponent`;
	const primaryChatConversation =
		availableChatConversations.find((c) => c.type === "scrim_lobby") ??
		availableChatConversations[0] ??
		null;

	return (
		<PageContainer>
			<PageHeader
				title={title}
				detail={`[${team.tag}] ${team.name}`}
				description={`Scheduled ${formatTimestamp(scrim.scheduledAt, "when both teams lock a time")}. Result reporting, confirmations, and evidence for this matchup all live here.`}
				badge={<ScrimStatusBadge status={scrim.status} />}
				actions={
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.scrims(team.id)}>Back to scrim queue</Link>
						</Button>
						<ScrimRespondActions
							scrimId={scrim.id}
							teamId={team.id}
							scrimStatus={scrim.status}
							awayTeamId={scrim.awayTeam?.id ?? null}
							scheduledAt={scrim.scheduledAt}
							canManage={team.currentUser.canManage}
						/>
						{canReportResult ? (
							<ReportScrimResultDialog scrim={scrim} reportingTeamId={team.id}>
								<Button size="sm">Review result</Button>
							</ReportScrimResultDialog>
						) : null}
						{canReviewConfirmation && currentConfirmation ? (
							<ConfirmScrimDialog
								scrimId={scrim.id}
								teamId={team.id}
								currentStatus={currentConfirmation.status}
							>
								<Button size="sm" variant="outline">
									Review confirmation
								</Button>
							</ConfirmScrimDialog>
						) : null}
						{canResolveDispute ? (
							<ResolveScrimDisputeDialog scrimId={scrim.id}>
								<Button size="sm" variant="outline">
									Resolve dispute
								</Button>
							</ResolveScrimDisputeDialog>
						) : null}
						{canUploadEvidence ? (
							<UploadScrimEvidenceDialog scrimId={scrim.id}>
								<Button size="sm" variant="outline">
									Upload evidence
								</Button>
							</UploadScrimEvidenceDialog>
						) : null}
						{primaryChatConversation ? (
							<Button asChild size="sm" variant="outline">
								<Link
									href={`${appRoutes.teams.chat(team.id)}?conversation=${primaryChatConversation.id}`}
								>
									Open scrim chat
								</Link>
							</Button>
						) : null}
					</div>
				}
			>
				{scrim.message ? (
					<p className="text-xs text-muted-foreground">Manager note: {scrim.message}</p>
				) : null}
			</PageHeader>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
				<div className="space-y-4">
					<ScrimSeriesOverview
						config={scrim.config}
						homeMapScore={scrim.homeMapScore}
						awayMapScore={scrim.awayMapScore}
						scheduledAt={scrim.scheduledAt}
						startedAt={scrim.startedAt}
						endedAt={scrim.endedAt}
						createdByDisplayName={scrim.createdByDisplayName}
						pendingConfirmationCount={scrim.pendingConfirmationCount}
					/>
					<ScrimConfirmationSection
						confirmations={scrim.confirmations}
						dispute={scrim.dispute}
						disputeResolution={disputeResolution}
						scrimId={scrim.id}
						scrimStatus={scrim.status}
						canResolveDispute={canResolveDispute}
					/>
					<ScrimMapsSection maps={scrim.maps} />
					<ScrimResultRevisions resultRevisions={scrim.resultRevisions} />
					<ScrimRatingSection
						ratingEvents={scrim.ratingEvents}
						chatConversations={availableChatConversations}
						teamId={team.id}
					/>
					<ScrimOcrJobsPanel
						scrimId={scrim.id}
						jobs={scrim.ocrJobs}
						canManage={team.currentUser.canManage}
					/>
				</div>

				<div className="space-y-4">
					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Current team context
						</p>
						<div className="mt-4 space-y-3 text-sm">
							<div className="border p-3">
								<p className="font-semibold">
									[{team.tag}] {team.name}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									You are viewing this scrim from the{" "}
									{scrim.homeTeam.id === team.id ? "home team" : "away team"} workspace.
								</p>
							</div>
							<div className="border p-3">
								<p className="font-semibold">
									{team.currentUser.canManage ? "Manager controls available" : "Member access"}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{team.currentUser.canManage
										? "You can accept requests, report results, and review confirmations from this team workspace."
										: "You can review scrim details here and upload evidence once the match is active."}
								</p>
							</div>
						</div>
					</section>

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Teams
						</p>
						<div className="mt-4 space-y-3">
							<div className="border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Home</p>
								<p className="mt-1 text-sm font-semibold">
									[{scrim.homeTeam.tag}] {scrim.homeTeam.name}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">Rating {scrim.homeTeam.rating}</p>
							</div>
							<div className="border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Away</p>
								{scrim.awayTeam ? (
									<>
										<p className="mt-1 text-sm font-semibold">
											[{scrim.awayTeam.tag}] {scrim.awayTeam.name}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											Rating {scrim.awayTeam.rating}
										</p>
									</>
								) : (
									<p className="mt-1 text-sm font-semibold">No opponent assigned yet</p>
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</PageContainer>
	);
}
