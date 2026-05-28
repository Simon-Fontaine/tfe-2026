import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmScrimDialog } from "@/components/scrims/confirm-scrim-dialog";
import { ReportScrimResultDialog } from "@/components/scrims/report-scrim-result-dialog";
import { ResolveScrimDisputeDialog } from "@/components/scrims/resolve-scrim-dispute-dialog";
import { ScrimConfirmationSection } from "@/components/scrims/scrim-confirmation-section";
import { ScrimDetailRealtimeSync } from "@/components/scrims/scrim-detail-realtime-sync";
import { ScrimDisputeResponseDialog } from "@/components/scrims/scrim-dispute-response-dialog";
import { ScrimLifecycleTimeline } from "@/components/scrims/scrim-lifecycle-timeline";
import { ScrimMapsSection } from "@/components/scrims/scrim-maps-section";
import { ScrimNegotiationHistory } from "@/components/scrims/scrim-negotiation-history";
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
	const teamState = await getTeamWithRosterRouteState(teamId, user.id);
	if (teamState.kind === "missing") notFound();
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
	if (!teamState.data.currentUser.canViewScrims) {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					detail={`[${teamState.data.tag}] ${teamState.data.name}`}
				/>
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to open this team's scrim workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const [scrimState, chatConversationsState] = await Promise.all([
		getScrimRouteState(scrimId),
		getScrimChatRouteState(scrimId),
	]);

	if (scrimState.kind === "missing") notFound();
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
	const canResolveDispute =
		scrim.status === "disputed" &&
		(team.currentUser.orgRole === "owner" || team.currentUser.orgRole === "admin");
	const reportingTeamFromLastRevision = scrim.resultRevisions[0]?.reportingTeamId ?? null;
	const canRespondToDispute =
		team.currentUser.canManage &&
		scrim.status === "disputed" &&
		team.id === reportingTeamFromLastRevision;
	const canReviewConfirmation =
		team.currentUser.canManage &&
		!canRespondToDispute &&
		(scrim.status === "awaiting_confirmation" || scrim.status === "disputed");
	const canUploadEvidence =
		team.currentUser.canManage &&
		!!scrim.awayTeam &&
		scrim.status !== "pending" &&
		scrim.status !== "cancelled";
	const disputeResolution =
		scrim.dispute.resolution ?? (scrim.status === "disputed" ? "pending" : null);

	const homeDisplayTag = scrim.homeTeamSnapshot?.tag ?? scrim.homeTeam.tag;
	const homeDisplayName = scrim.homeTeamSnapshot?.name ?? scrim.homeTeam.name;
	const awayDisplayTag = scrim.awayTeam
		? (scrim.awayTeamSnapshot?.tag ?? scrim.awayTeam.tag)
		: (scrim.awayTeamSnapshot?.tag ?? null);
	const awayDisplayName = scrim.awayTeam
		? (scrim.awayTeamSnapshot?.name ?? scrim.awayTeam.name)
		: (scrim.awayTeamSnapshot?.name ?? null);
	const title = awayDisplayTag
		? `[${homeDisplayTag}] ${homeDisplayName} vs [${awayDisplayTag}] ${awayDisplayName}`
		: `[${homeDisplayTag}] ${homeDisplayName} vs Open opponent`;
	const primaryChatConversation =
		availableChatConversations.find((c) => c.type === "scrim_lobby") ??
		availableChatConversations[0] ??
		null;

	return (
		<PageContainer>
			<ScrimDetailRealtimeSync scrimId={scrim.id} />
			<PageHeader
				title={title}
				detail={`[${team.tag}] ${team.name}`}
				description={`Scheduled ${formatTimestamp(scrim.scheduledAt, "when both teams lock a time")}. Result reporting, confirmations, and evidence for this matchup all live here.`}
				badge={
					<ScrimStatusBadge status={scrim.status} disputeResolution={scrim.dispute.resolution} />
				}
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
						{canReviewConfirmation ? (
							<ConfirmScrimDialog
								scrimId={scrim.id}
								teamId={team.id}
								currentStatus={currentConfirmation?.status ?? "pending"}
							>
								<Button size="sm" variant="outline">
									Review confirmation
								</Button>
							</ConfirmScrimDialog>
						) : null}
						{canRespondToDispute ? (
							<ScrimDisputeResponseDialog scrimId={scrim.id} reportingTeamId={team.id}>
								<Button size="sm" variant="outline">
									Respond to dispute
								</Button>
							</ScrimDisputeResponseDialog>
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
					<ScrimNegotiationHistory revisions={scrim.negotiationRevisions} />
					{scrim.status === "cancelled" && team.currentUser.canManage ? (
						<section className="border p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Schedule recovery
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								This scrim was cancelled. You can request a new scrim with the same or a different
								opponent from the scrim queue.
							</p>
							<div className="mt-3">
								<Button asChild size="sm" variant="outline">
									<Link href={appRoutes.teams.scrims(team.id)}>Go to scrim queue</Link>
								</Button>
							</div>
						</section>
					) : null}
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
						resultRevisions={scrim.resultRevisions}
						maps={scrim.maps}
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
										: "You can review scrim details and follow match status from this team workspace."}
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
									[{homeDisplayTag}] {homeDisplayName}
									{scrim.homeTeam.isArchived && (
										<span className="ml-1 text-xs font-normal text-muted-foreground">
											(archived)
										</span>
									)}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">Rating {scrim.homeTeam.rating}</p>
							</div>
							<div className="border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Away</p>
								{scrim.awayTeam ? (
									<>
										<p className="mt-1 text-sm font-semibold">
											[{scrim.awayTeamSnapshot?.tag ?? scrim.awayTeam.tag}]{" "}
											{scrim.awayTeamSnapshot?.name ?? scrim.awayTeam.name}
											{scrim.awayTeam.isArchived && (
												<span className="ml-1 text-xs font-normal text-muted-foreground">
													(archived)
												</span>
											)}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											Rating {scrim.awayTeam.rating}
										</p>
									</>
								) : scrim.awayTeamSnapshot ? (
									<p className="mt-1 text-sm font-semibold">
										[{scrim.awayTeamSnapshot.tag}] {scrim.awayTeamSnapshot.name}
										<span className="ml-1 text-xs font-normal text-muted-foreground">
											(no longer available)
										</span>
									</p>
								) : (
									<p className="mt-1 text-sm font-semibold">No opponent assigned yet</p>
								)}
							</div>
						</div>
					</section>
					<ScrimLifecycleTimeline scrim={scrim} />
				</div>
			</div>
		</PageContainer>
	);
}
