import {
	Calendar03Icon,
	LinkSquare02Icon,
	MessageNotification02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmScrimDialog } from "@/components/scrims/confirm-scrim-dialog";
import { ReportScrimResultDialog } from "@/components/scrims/report-scrim-result-dialog";
import { ResolveScrimDisputeDialog } from "@/components/scrims/resolve-scrim-dispute-dialog";
import { ScrimOcrJobsPanel } from "@/components/scrims/scrim-ocr-jobs-panel";
import { ScrimRespondActions } from "@/components/scrims/scrim-respond-actions";
import { ScrimStatusBadge } from "@/components/scrims/scrim-status-badge";
import { UploadScrimEvidenceDialog } from "@/components/scrims/upload-scrim-evidence-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getScrimChatRouteState } from "@/lib/data/chat";
import { getScrimRouteState } from "@/lib/data/scrims";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { routeStateWrongContext } from "@/lib/route-state";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	if (!value) return emptyLabel;

	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function formatSignedRatingDelta(value: number) {
	return value > 0 ? `+${value}` : `${value}`;
}

function formatOptionalStat(value: number | null) {
	return value === null ? "—" : String(value);
}

function formatRevisionBasisLabel(
	basis: ScrimDetail["resultRevisions"][number]["changeSummary"]["basis"]
) {
	if (basis === "ocr_job") return "OCR draft";
	if (basis === "previous_revision") return "previous revision";
	if (basis === "existing_result") return "existing result";
	return "empty baseline";
}

function formatRevisionValue(
	value: ScrimDetail["resultRevisions"][number]["changeSummary"]["fieldChanges"][number]["before"]
) {
	if (value === null) return "empty";
	if (typeof value === "string") return value || '""';
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	const serialized = JSON.stringify(value);
	return serialized.length > 80 ? `${serialized.slice(0, 77)}...` : serialized;
}

function getSupportingScoreboardJobCount(revision: ScrimDetail["resultRevisions"][number]) {
	return new Set(
		revision.snapshot.maps.flatMap((map) =>
			map.scoreboardOcrJobId ? [map.scoreboardOcrJobId] : []
		)
	).size;
}

function getConfirmationVariant(status: "pending" | "confirmed" | "disputed") {
	if (status === "disputed") return "destructive" as const;
	if (status === "confirmed") return "secondary" as const;
	return "outline" as const;
}

function getDisputeResolutionVariant(resolution: string | null) {
	if (resolution === "voided") return "destructive" as const;
	if (resolution === "admin_resolved") return "secondary" as const;
	return "outline" as const;
}

function getDisputeResolutionLabel(resolution: string | null) {
	if (resolution === "pending") return "Awaiting resolution";
	if (resolution === "admin_resolved") return "Result finalized";
	if (resolution === "voided") return "Scrim voided";
	if (resolution === "home_confirmed") return "Home team confirmed";
	if (resolution === "away_confirmed") return "Away team confirmed";
	return "Not required";
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
				<PageHeader title="Scrim detail" detail={`Team ${teamId}`} />
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

	const scrimContext =
		scrimState.data.homeTeam.id !== teamState.data.id &&
		scrimState.data.awayTeam?.id !== teamState.data.id
			? routeStateWrongContext("team", teamId)
			: null;
	if (scrimContext) {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					detail={`[${teamState.data.tag}] ${teamState.data.name}`}
				/>
				<EmptyStateBlock
					title="Wrong team context"
					description="This scrim exists, but it does not belong to the team workspace in the current URL. Return to the scrim queue and open it from the matching team."
					actionHref={appRoutes.teams.scrims(teamState.data.id)}
					actionLabel="Back to scrim queue"
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (chatConversationsState.kind === "missing") {
		notFound();
	}
	const team = teamState.data;
	const scrim = scrimState.data;
	const availableChatConversations =
		chatConversationsState.kind === "success" ? chatConversationsState.data : [];

	const currentConfirmation =
		scrim.confirmations.find((confirmation) => confirmation.teamId === team.id) ?? null;
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
		availableChatConversations.find((conversation) => conversation.type === "scrim_lobby") ??
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
					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Series overview
						</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<div className="space-y-1 border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Series score
								</p>
								<p className="text-sm font-semibold">
									{scrim.homeMapScore} - {scrim.awayMapScore}
								</p>
							</div>
							<div className="space-y-1 border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Preferred start
								</p>
								<p className="text-sm font-semibold">
									{formatTimestamp(scrim.scheduledAt, "Not scheduled")}
								</p>
							</div>
							<div className="space-y-1 border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Reported start
								</p>
								<p className="text-sm font-semibold">
									{formatTimestamp(scrim.startedAt, "Not reported")}
								</p>
							</div>
							<div className="space-y-1 border p-3">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Reported end
								</p>
								<p className="text-sm font-semibold">
									{formatTimestamp(scrim.endedAt, "Not reported")}
								</p>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap gap-2">
							<Badge variant="outline">
								Format: {scrim.config.format ?? `Best of ${scrim.config.bestOf ?? 5}`}
							</Badge>
							<Badge variant="outline">
								Created by: {scrim.createdByDisplayName ?? "Unknown manager"}
							</Badge>
							<Badge variant="outline">
								{scrim.pendingConfirmationCount} confirmation step(s) open
							</Badge>
						</div>
					</section>

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Confirmation state
						</p>
						<div className="mt-4 space-y-3">
							{scrim.confirmations.map((confirmation) => (
								<div key={confirmation.id} className="border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p className="text-sm font-semibold">
												[{confirmation.teamTag}] {confirmation.teamName}
											</p>
											<p className="text-xs text-muted-foreground">
												{confirmation.confirmedByDisplayName
													? `Last handled by ${confirmation.confirmedByDisplayName}`
													: "No manager confirmation submitted yet."}
											</p>
										</div>
										<Badge variant={getConfirmationVariant(confirmation.status)}>
											{confirmation.status}
										</Badge>
									</div>

									<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
											<span>
												{formatTimestamp(confirmation.confirmedAt, "No confirmation time")}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
											<span>Last updated {formatTimestamp(confirmation.updatedAt)}</span>
										</div>
									</div>

									{confirmation.disputeReason ? (
										<p className="mt-3 text-xs text-destructive">
											Dispute reason: {confirmation.disputeReason}
										</p>
									) : null}
								</div>
							))}
						</div>
					</section>

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Reviewed maps and stats
						</p>
						<div className="mt-4 space-y-3">
							{scrim.maps.length === 0 ? (
								<div className="border p-3">
									<p className="text-sm font-semibold">No reviewed map data saved yet</p>
									<p className="mt-1 text-xs text-muted-foreground">
										The series score exists, but per-map and per-player data has not been submitted
										yet.
									</p>
								</div>
							) : (
								scrim.maps.map((map) => (
									<div key={map.id} className="border p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-sm font-semibold">
													Map {map.mapOrder}: {map.mapName}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{map.mapType.replaceAll("_", " ")} · {map.homeScore}-{map.awayScore} ·{" "}
													{map.result}
													{map.durationSeconds !== null
														? ` · ${Math.round(map.durationSeconds / 60)}m`
														: ""}
												</p>
											</div>
											<Badge variant="outline">{map.players.length} player row(s)</Badge>
										</div>

										{map.players.length > 0 ? (
											<div className="mt-3 space-y-2">
												{map.players.map((player) => (
													<div key={player.id} className="border p-2 text-xs">
														<div className="flex flex-wrap items-center justify-between gap-2">
															<p className="font-semibold">
																{player.playerName}
																<span className="ml-2 text-muted-foreground">
																	{player.side}
																	{player.hero ? ` · ${player.hero}` : ""}
																	{player.role ? ` · ${player.role}` : ""}
																</span>
															</p>
															<p className="text-muted-foreground">
																E {formatOptionalStat(player.eliminations)} · A{" "}
																{formatOptionalStat(player.assists)} · D{" "}
																{formatOptionalStat(player.deaths)}
															</p>
														</div>
														<p className="mt-1 text-muted-foreground">
															DMG {formatOptionalStat(player.damage)} · HEAL{" "}
															{formatOptionalStat(player.healing)} · MIT{" "}
															{formatOptionalStat(player.mitigation)}
														</p>
													</div>
												))}
											</div>
										) : null}
									</div>
								))
							)}
						</div>
					</section>

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Result revision history
						</p>
						<div className="mt-4 space-y-3">
							{scrim.resultRevisions.length === 0 ? (
								<div className="border p-3">
									<p className="text-sm font-semibold">No reviewed result revisions yet</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Once a manager submits a reviewed result package, every subsequent revision will
										be preserved here with its correction diff.
									</p>
								</div>
							) : (
								scrim.resultRevisions.map((revision) => {
									const visibleFieldChanges = revision.changeSummary.fieldChanges.slice(0, 8);
									const hiddenChangeCount =
										revision.changeSummary.fieldChanges.length - visibleFieldChanges.length;
									const supportingScoreboardJobCount = getSupportingScoreboardJobCount(revision);
									const hasOcrEvidence =
										!!revision.sourceOcrJobId || supportingScoreboardJobCount > 0;

									return (
										<div key={revision.id} className="border p-3">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div>
													<p className="text-sm font-semibold">
														Revision #{revision.revisionNumber}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{revision.submittedByDisplayName
															? `Submitted by ${revision.submittedByDisplayName}`
															: "Submitted by an unknown manager"}
														{revision.reportingTeamName
															? ` from [${revision.reportingTeamTag ?? "TEAM"}] ${revision.reportingTeamName}`
															: ""}
														{" · "}
														{formatTimestamp(revision.createdAt)}
													</p>
												</div>
												<div className="flex flex-wrap gap-2">
													<Badge variant="outline">
														{revision.homeMapScore} - {revision.awayMapScore}
													</Badge>
													<Badge variant="outline">
														{revision.changeSummary.changeCount} change(s) vs{" "}
														{formatRevisionBasisLabel(revision.changeSummary.basis)}
													</Badge>
													<Badge variant="outline">
														{hasOcrEvidence ? "OCR-assisted" : "Manual"}
													</Badge>
													{supportingScoreboardJobCount > 0 ? (
														<Badge variant="outline">
															{supportingScoreboardJobCount} scoreboard OCR job(s)
														</Badge>
													) : null}
												</div>
											</div>

											<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
												<div className="flex items-center gap-2">
													<HugeiconsIcon
														icon={Calendar03Icon}
														strokeWidth={2}
														className="size-3.5"
													/>
													<span>
														Series window {formatTimestamp(revision.startedAt, "Not set")} to{" "}
														{formatTimestamp(revision.endedAt, "Not set")}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<HugeiconsIcon
														icon={LinkSquare02Icon}
														strokeWidth={2}
														className="size-3.5"
													/>
													<span>
														{revision.snapshot.maps.length} map row(s) ·{" "}
														{revision.snapshot.maps.reduce(
															(total, map) => total + map.players.length,
															0
														)}{" "}
														player row(s)
													</span>
												</div>
											</div>

											{revision.sourceOcrJobId || supportingScoreboardJobCount > 0 ? (
												<p className="mt-3 text-xs text-muted-foreground">
													Primary OCR draft: {revision.sourceOcrJobId ?? "none"}
													{supportingScoreboardJobCount > 0
														? ` · Supporting scoreboard jobs: ${supportingScoreboardJobCount}`
														: ""}
												</p>
											) : null}

											{visibleFieldChanges.length > 0 ? (
												<div className="mt-3 space-y-2">
													{visibleFieldChanges.map((fieldChange) => (
														<div key={fieldChange.path} className="border p-2 text-xs">
															<p className="font-medium">{fieldChange.path}</p>
															<p className="mt-1 text-muted-foreground">
																{formatRevisionValue(fieldChange.before)} →{" "}
																{formatRevisionValue(fieldChange.after)}
															</p>
														</div>
													))}
													{hiddenChangeCount > 0 ? (
														<p className="text-xs text-muted-foreground">
															+ {hiddenChangeCount} more change(s) in this revision
														</p>
													) : null}
												</div>
											) : (
												<p className="mt-3 text-xs text-muted-foreground">
													This revision matches its comparison baseline exactly.
												</p>
											)}
										</div>
									);
								})
							)}
						</div>
					</section>

					{scrim.status === "disputed" || scrim.dispute.resolution ? (
						<section className="border p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Dispute resolution
							</p>
							<div className="mt-4 space-y-3">
								<div className="border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p className="text-sm font-semibold">
												{getDisputeResolutionLabel(disputeResolution)}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{scrim.dispute.resolvedByDisplayName
													? `Resolved by ${scrim.dispute.resolvedByDisplayName}`
													: "This scrim still needs org-level dispute review."}
											</p>
										</div>
										<Badge variant={getDisputeResolutionVariant(disputeResolution)}>
											{getDisputeResolutionLabel(disputeResolution)}
										</Badge>
									</div>

									<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
											<span>
												{formatTimestamp(scrim.dispute.resolvedAt, "No resolution timestamp")}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
											<span>
												{scrim.dispute.resolvedAt
													? "This dispute has already been settled."
													: canResolveDispute
														? "You can resolve this dispute from the current org context."
														: "Only org-level managers can resolve disputed scrims."}
											</span>
										</div>
									</div>

									{scrim.dispute.notes ? (
										<p className="mt-3 text-xs text-muted-foreground">
											Resolution notes: {scrim.dispute.notes}
										</p>
									) : null}
								</div>
							</div>
						</section>
					) : null}

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Rating outcome
						</p>
						<div className="mt-4 space-y-3">
							{scrim.ratingEvents.length === 0 ? (
								<div className="border p-3">
									<p className="text-sm font-semibold">Ratings are still frozen</p>
									<p className="mt-1 text-xs text-muted-foreground">
										The match rating only changes after both teams confirm the reported result.
									</p>
								</div>
							) : (
								scrim.ratingEvents.map((event) => (
									<div key={event.id} className="border p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-sm font-semibold">
													[{event.teamTag}] {event.teamName}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Rating {event.ratingBefore} → {event.ratingAfter}
												</p>
											</div>
											<Badge
												variant={event.ratingDelta === 0 ? "outline" : "secondary"}
												className={
													event.ratingDelta > 0
														? "text-green-600"
														: event.ratingDelta < 0
															? "text-destructive"
															: undefined
												}
											>
												{formatSignedRatingDelta(event.ratingDelta)}
											</Badge>
										</div>
									</div>
								))
							)}
						</div>
					</section>

					<section className="border p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Chat channels
						</p>
						<div className="mt-4 space-y-3">
							{availableChatConversations.length === 0 ? (
								<div className="border p-3">
									<p className="text-sm font-semibold">No scrim channels yet</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Negotiation chat appears once both teams are assigned. Lobby chat appears after
										the scrim is accepted.
									</p>
								</div>
							) : (
								availableChatConversations.map((conversation) => (
									<div key={conversation.id} className="border p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-sm font-semibold">{conversation.name}</p>
												<p className="text-xs text-muted-foreground">
													{conversation.type === "scrim_lobby"
														? "Live match lobby for both rosters."
														: "Manager-only negotiation thread."}
												</p>
											</div>
											<Button asChild size="sm" variant="outline">
												<Link
													href={`${appRoutes.teams.chat(team.id)}?conversation=${conversation.id}`}
												>
													Open
												</Link>
											</Button>
										</div>
										<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
											<HugeiconsIcon
												icon={MessageNotification02Icon}
												strokeWidth={2}
												className="size-3.5"
											/>
											<span>
												{conversation.unreadCount} unread · {conversation.participantCount}{" "}
												participant
												{conversation.participantCount === 1 ? "" : "s"}
											</span>
										</div>
									</div>
								))
							)}
						</div>
					</section>

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
