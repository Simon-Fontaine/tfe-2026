"use client";

import {
	Calendar03Icon,
	Image01Icon,
	LinkSquare02Icon,
	RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
	AppRealtimeEvent,
	OcrJobSummary,
	ScrimMapSummary,
	ScrimResultRevisionSummary,
} from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { readApiPayload } from "./form-errors";
import { UploadScrimEvidenceDialog } from "./upload-scrim-evidence-dialog";

const ACTIVE_JOB_STATUSES = new Set(["queued", "processing"]);

const MAP_TYPE_CONFIG: Record<string, { border: string; label: string }> = {
	assault: { border: "border-l-red-500", label: "Assault" },
	control: { border: "border-l-sky-500", label: "Control" },
	escort: { border: "border-l-emerald-500", label: "Escort" },
	hybrid: { border: "border-l-violet-500", label: "Hybrid" },
	push: { border: "border-l-indigo-400", label: "Push" },
	flashpoint: { border: "border-l-amber-500", label: "Flashpoint" },
	clash: { border: "border-l-rose-500", label: "Clash" },
	unknown: { border: "border-l-border", label: "Unknown" },
};

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	if (!value) return emptyLabel;

	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getJobBadgeClass(job: OcrJobSummary) {
	if (job.status === "failed") return STATUS_BADGE_CLASSES.blocked;
	if (job.status === "completed") return STATUS_BADGE_CLASSES.completed;
	if (job.status === "requires_review") return STATUS_BADGE_CLASSES.pending;
	if (job.status === "superseded") return STATUS_BADGE_CLASSES.inactive;
	return STATUS_BADGE_CLASSES.underReview;
}

function getStageLabel(job: OcrJobSummary) {
	if (job.status === "failed") return "Failed";
	if (job.status === "requires_review") return "Requires review";
	if (job.status === "completed") return "Completed";
	if (job.status === "superseded") return "Superseded";

	switch (job.progressStage) {
		case "claimed":
			return "Claimed";
		case "preprocessing":
			return "Preprocessing";
		case "provider_request":
			return "Calling Gemini";
		case "validating":
			return "Validating";
		default:
			return "Queued";
	}
}

function getStageProgress(stage: OcrJobSummary["progressStage"]) {
	switch (stage) {
		case "claimed":
			return 20;
		case "preprocessing":
			return 40;
		case "provider_request":
			return 68;
		case "validating":
			return 88;
		case "requires_review":
		case "completed":
		case "failed":
			return 100;
		default:
			return 8;
	}
}

function formatConfidenceFlag(flag: string) {
	return flag.replaceAll("_", " ");
}

function deriveGameHistorySeriesScore(matches: Array<{ result: "victory" | "defeat" | "draw" }>) {
	return matches.reduce(
		(score, match) => {
			if (match.result === "victory") score.home += 1;
			else if (match.result === "defeat") score.away += 1;
			return score;
		},
		{ home: 0, away: 0 }
	);
}

function formatScoreboardPlayerLine(player: {
	playerName: string;
	role: string | null;
	hero: string | null;
}) {
	const segments = [player.playerName || "Unknown player"];
	if (player.role) segments.push(player.role);
	if (player.hero) segments.push(player.hero);
	return segments.join(" • ");
}

interface ScrimOcrJobsPanelProps {
	scrimId: string;
	jobs: OcrJobSummary[];
	canManage: boolean;
	canUploadEvidence?: boolean;
	uploadDisabledReason?: string | null;
	resultRevisions?: ScrimResultRevisionSummary[];
	maps?: ScrimMapSummary[];
}

export function ScrimOcrJobsPanel({
	scrimId,
	jobs,
	canManage,
	canUploadEvidence = false,
	uploadDisabledReason = null,
	resultRevisions = [],
	maps = [],
}: ScrimOcrJobsPanelProps) {
	const router = useRouter();
	const [liveJobs, setLiveJobs] = useState(jobs);
	const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
	const [supersedingJobId, setSupersedingJobId] = useState<string | null>(null);
	const [fetchingEvidenceJobId, setFetchingEvidenceJobId] = useState<string | null>(null);
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setLiveJobs(jobs);
	}, [jobs]);

	useEffect(() => {
		function scheduleRefresh() {
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
			}
			refreshTimerRef.current = setTimeout(() => {
				refreshTimerRef.current = null;
				startTransition(() => {
					router.refresh();
				});
			}, 500);
		}

		function handleRealtimeEvent(event: AppRealtimeEvent) {
			if (event.type !== "scrim:ocr-job-updated" || event.scrimId !== scrimId) return;

			setLiveJobs((current) => {
				const next = [...current];
				const index = next.findIndex((job) => job.id === event.job.jobId);

				if (index === -1) {
					scheduleRefresh();
					return current;
				}

				next[index] = {
					...next[index],
					status: event.job.status,
					progressStage: event.job.progressStage,
					errorMessage: event.job.errorMessage,
					retryCount: event.job.retryCount,
					processingTimeMs: event.job.processingTimeMs,
					updatedAt: event.job.updatedAt,
				};

				return next;
			});

			if (
				event.job.status === "completed" ||
				event.job.status === "requires_review" ||
				event.job.status === "failed" ||
				event.job.status === "superseded"
			) {
				scheduleRefresh();
			}
		}

		realtimeSocket.subscribeScrim(scrimId);
		const removeListener = realtimeSocket.addListener(handleRealtimeEvent);

		return () => {
			removeListener();
			realtimeSocket.unsubscribeScrim(scrimId);
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
		};
	}, [router, scrimId]);

	useEffect(() => {
		if (!liveJobs.some((job) => ACTIVE_JOB_STATUSES.has(job.status))) return;

		const interval = window.setInterval(() => {
			startTransition(() => {
				router.refresh();
			});
		}, 5_000);

		return () => window.clearInterval(interval);
	}, [liveJobs, router]);

	async function handleRetry(jobId: string) {
		if (retryingJobId) return;
		setRetryingJobId(jobId);
		const loading = toast.loading("Re-queueing OCR job…");

		try {
			const response = await fetch(apiRoutes.scrims.retryOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to retry OCR job.", { id: loading });
				return;
			}

			toast.success("OCR job re-queued.", { id: loading });
			startTransition(() => {
				router.refresh();
			});
		} catch {
			toast.error("Unable to reach the API server.", { id: loading });
		} finally {
			setRetryingJobId(null);
		}
	}

	async function handleSupersede(jobId: string) {
		if (supersedingJobId) return;
		setSupersedingJobId(jobId);
		const loading = toast.loading("Superseding OCR job…");

		try {
			const response = await fetch(apiRoutes.scrims.supersedeOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to supersede OCR job.", { id: loading });
				return;
			}

			toast.success("OCR job marked superseded.", { id: loading });
			startTransition(() => {
				router.refresh();
			});
		} catch {
			toast.error("Unable to reach the API server.", { id: loading });
		} finally {
			setSupersedingJobId(null);
		}
	}

	async function handleOpenEvidence(jobId: string) {
		if (fetchingEvidenceJobId) return;
		setFetchingEvidenceJobId(jobId);

		try {
			const response = await fetch(apiRoutes.scrims.ocrJobEvidenceUrl(scrimId, jobId), {
				credentials: "include",
			});
			const payload = await readApiPayload<{ url: string; expiresAt: string }>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to generate evidence URL.");
				return;
			}

			window.open(payload.data.url, "_blank", "noreferrer");
		} catch {
			toast.error("Unable to reach the API server.");
		} finally {
			setFetchingEvidenceJobId(null);
		}
	}

	// Latest non-superseded scoreboard job per map
	const scoreboardJobByMapId = new Map<string, OcrJobSummary>();
	for (const job of liveJobs) {
		if (job.screenshotType !== "scoreboard" || !job.scrimMapId || job.status === "superseded")
			continue;
		const existing = scoreboardJobByMapId.get(job.scrimMapId);
		if (!existing || job.createdAt > existing.createdAt) {
			scoreboardJobByMapId.set(job.scrimMapId, job);
		}
	}

	const revisionsByOcrJobId = new Map<string, ScrimResultRevisionSummary[]>();
	for (const revision of resultRevisions) {
		if (revision.sourceOcrJobId) {
			const existing = revisionsByOcrJobId.get(revision.sourceOcrJobId) ?? [];
			existing.push(revision);
			revisionsByOcrJobId.set(revision.sourceOcrJobId, existing);
		}
	}

	const mapsByOcrJobId = new Map<string, ScrimMapSummary[]>();
	for (const map of maps) {
		if (map.ocrJobId) {
			const existing = mapsByOcrJobId.get(map.ocrJobId) ?? [];
			existing.push(map);
			mapsByOcrJobId.set(map.ocrJobId, existing);
		}
	}

	const mapsById = new Map<string, ScrimMapSummary>();
	for (const map of maps) {
		mapsById.set(map.id, map);
	}

	const latestRevision =
		resultRevisions.length > 0
			? resultRevisions.reduce((a, b) => (b.revisionNumber > a.revisionNumber ? b : a))
			: null;
	const importedScoreboardJobIds = new Set<string>();
	if (latestRevision) {
		for (const map of latestRevision.snapshot.maps) {
			if (map.scoreboardOcrJobId) {
				importedScoreboardJobIds.add(map.scoreboardOcrJobId);
			}
		}
	}
	const activeGameHistoryJob =
		liveJobs.find((job) => job.screenshotType === "game_history" && job.status !== "superseded") ??
		null;
	const mapsWithAppliedScoreboard = new Set<string>();
	for (const job of liveJobs) {
		if (job.scrimMapId && importedScoreboardJobIds.has(job.id)) {
			mapsWithAppliedScoreboard.add(job.scrimMapId);
		}
	}
	const latestRevisionScoreboardCount =
		latestRevision?.snapshot.maps.filter((map) => !!map.scoreboardOcrJobId).length ?? 0;
	const scoreboardCoverageLabel =
		maps.length > 0
			? `${latestRevisionScoreboardCount}/${maps.length} map(s) with verified stats`
			: "Scoreboard slots appear after maps exist";

	return (
		<section className="border p-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Match result package
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Use scans as draft assistance. Maps, stats, and evidence become official only when the
						result package is submitted.
					</p>
				</div>
				<Badge variant="outline" className={STATUS_BADGE_CLASSES.active}>
					{scoreboardCoverageLabel}
				</Badge>
			</div>

			<div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
				<div className="border p-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Series scan
							</p>
							<p className="mt-1 text-sm font-semibold">
								{activeGameHistoryJob
									? getStageLabel(activeGameHistoryJob)
									: "No game history attached"}
							</p>
						</div>
						{activeGameHistoryJob ? (
							<Badge variant="outline" className={getJobBadgeClass(activeGameHistoryJob)}>
								{activeGameHistoryJob.status === "completed"
									? "Draft source"
									: getStageLabel(activeGameHistoryJob)}
							</Badge>
						) : null}
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						Game-history screenshots can draft the map list and scores, but they do not save
						anything until you submit the package.
					</p>
					{activeGameHistoryJob ? (
						<div className="mt-3 space-y-2">
							<Progress value={getStageProgress(activeGameHistoryJob.progressStage)} />
							{activeGameHistoryJob.validatedOutput?.screenshotType === "game_history" ? (
								<p className="text-xs text-muted-foreground">
									Found {activeGameHistoryJob.validatedOutput.matches.length} visible map row(s).
									Open the Result Workbench to use this scan as a draft.
								</p>
							) : activeGameHistoryJob.status === "failed" ? (
								<p className="text-xs text-destructive">
									{activeGameHistoryJob.errorMessage ??
										"The scan failed before maps could be read."}
								</p>
							) : (
								<p className="text-xs text-muted-foreground">Reading screenshot for map rows.</p>
							)}
						</div>
					) : canUploadEvidence ? (
						<UploadScrimEvidenceDialog scrimId={scrimId} screenshotType="game_history">
							<Button type="button" size="sm" className="mt-3 w-full">
								Upload game history
							</Button>
						</UploadScrimEvidenceDialog>
					) : (
						<p className="mt-3 border p-2 text-xs text-muted-foreground">
							{uploadDisabledReason ?? "Evidence uploads are not available for this scrim."}
						</p>
					)}
				</div>

				<div className="border p-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Map scoreboard evidence
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Scoreboards are optional trust boosters. Attach them when player stats matter.
					</p>
					{maps.length === 0 ? (
						<p className="mt-3 border p-3 text-xs text-muted-foreground">
							No reviewed maps yet. Add maps manually or use a series scan as a draft before
							attaching per-map scoreboards.
						</p>
					) : (
						<div className="mt-3 grid gap-3 xl:grid-cols-2">
							{maps.map((map) => {
								const existingJob = scoreboardJobByMapId.get(map.id);
								const typeConfig = MAP_TYPE_CONFIG[map.mapType] ?? MAP_TYPE_CONFIG.unknown;
								const isActive = existingJob && ACTIVE_JOB_STATUSES.has(existingJob.status);
								const isImported = existingJob
									? importedScoreboardJobIds.has(existingJob.id)
									: false;
								const statusLabel = !existingJob
									? "No scoreboard attached"
									: isImported
										? "Verified stats"
										: existingJob.status === "completed"
											? "Ready to review"
											: getStageLabel(existingJob);
								const statusClass = !existingJob
									? STATUS_BADGE_CLASSES.inactive
									: isImported
										? STATUS_BADGE_CLASSES.completed
										: getJobBadgeClass(existingJob);
								return (
									<div
										key={map.id}
										className={cn(
											"relative overflow-hidden border border-l-4 p-3",
											typeConfig.border
										)}
									>
										{map.imageUrl ? (
											<>
												<div
													className="absolute inset-0 bg-cover bg-center"
													style={{ backgroundImage: `url(${map.imageUrl})` }}
												/>
												<div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
											</>
										) : null}

										<div className="relative flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
													Map {map.mapOrder}
												</p>
												<p className="truncate text-sm font-semibold">{map.mapName}</p>
												<p className="text-xs text-muted-foreground">
													{typeConfig.label} · {map.homeScore}-{map.awayScore}
												</p>
											</div>
											<Badge variant="outline" className={cn("shrink-0", statusClass)}>
												{statusLabel}
											</Badge>
										</div>

										<div className="relative mt-2.5">
											{isActive && existingJob ? (
												<div className="space-y-2">
													<Progress value={getStageProgress(existingJob.progressStage)} />
													<p className="text-xs text-muted-foreground">Reading player stats…</p>
												</div>
											) : existingJob ? (
												<div className="space-y-2">
													<p className="text-xs text-muted-foreground">
														{isImported
															? "This scoreboard is applied in the latest submitted package."
															: existingJob.status === "completed"
																? "Open the Result Workbench to preview rows before applying them to the draft."
																: existingJob.status === "failed"
																	? (existingJob.errorMessage ?? "This scoreboard scan failed.")
																	: "Review or replace this scoreboard evidence."}
													</p>
													{canManage && canUploadEvidence ? (
														<div className="flex flex-wrap gap-1.5">
															{existingJob.status === "failed" ||
															existingJob.status === "requires_review" ? (
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => handleRetry(existingJob.id)}
																	disabled={retryingJobId === existingJob.id}
																>
																	Retry scan
																</Button>
															) : null}
															<Button
																type="button"
																size="sm"
																variant="ghost"
																onClick={() => handleSupersede(existingJob.id)}
																disabled={!!supersedingJobId}
															>
																Replace
															</Button>
														</div>
													) : null}
												</div>
											) : canUploadEvidence ? (
												<UploadScrimEvidenceDialog
													scrimId={scrimId}
													screenshotType="scoreboard"
													targetMapId={map.id}
													targetMapLabel={`Map ${map.mapOrder}: ${map.mapName}`}
												>
													<Button type="button" size="sm" variant="outline" className="w-full">
														Add scoreboard
													</Button>
												</UploadScrimEvidenceDialog>
											) : (
												<p className="text-xs text-muted-foreground">
													{uploadDisabledReason ?? "Scoreboard uploads are not available."}
												</p>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>

			<div className="mt-4">
				{liveJobs.length === 0 ? (
					<EmptyStateBlock
						icon={Image01Icon}
						title="No evidence uploaded yet"
						description="Upload match history or scoreboard screenshots to start the extraction pipeline for this scrim."
						variant="inline"
					/>
				) : (
					<div className="space-y-3">
						{liveJobs.map((job) => (
							<div
								key={job.id}
								className={`border p-3${job.status === "superseded" ? " opacity-60" : ""}`}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="text-sm font-semibold capitalize">
											{job.screenshotType.replace("_", " ")}
										</p>
										<p className="text-xs text-muted-foreground">
											Submitted by {job.submittedByDisplayName ?? "Unknown user"}
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline" className={getJobBadgeClass(job)}>
											{getStageLabel(job)}
										</Badge>
										{canManage &&
										canUploadEvidence &&
										(job.status === "failed" || job.status === "requires_review") ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => handleRetry(job.id)}
												disabled={retryingJobId === job.id}
											>
												<HugeiconsIcon
													icon={RefreshIcon}
													strokeWidth={2}
													className="mr-1.5 size-3.5"
												/>
												Retry
											</Button>
										) : null}
										{canManage &&
										canUploadEvidence &&
										(job.status === "completed" ||
											job.status === "failed" ||
											job.status === "requires_review") ? (
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => handleSupersede(job.id)}
												disabled={!!supersedingJobId}
											>
												Mark superseded
											</Button>
										) : null}
									</div>
								</div>

								<div className="mt-3 space-y-2">
									<Progress value={getStageProgress(job.progressStage)} />
									<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
											<span>Queued {formatTimestamp(job.createdAt)}</span>
										</div>
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
											<span>Retry count {job.retryCount}</span>
										</div>
										<div className="flex items-center gap-2">
											<span>
												{job.processingTimeMs
													? `${Math.round(job.processingTimeMs / 100) / 10}s processing time`
													: job.runAfter
														? `Run after ${formatTimestamp(job.runAfter)}`
														: "Waiting for worker"}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => handleOpenEvidence(job.id)}
												disabled={!!fetchingEvidenceJobId}
												className="underline-offset-4 hover:underline disabled:opacity-50"
											>
												{fetchingEvidenceJobId === job.id ? "Opening…" : "Open uploaded screenshot"}
											</button>
										</div>
									</div>
								</div>

								{job.validatedOutput ? (
									<div className="mt-3 border p-3">
										{job.validatedOutput.screenshotType === "game_history" ? (
											(() => {
												const seriesScore = deriveGameHistorySeriesScore(
													job.validatedOutput.matches
												);

												return (
													<>
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="outline">
																Series {seriesScore.home}-{seriesScore.away}
															</Badge>
															<Badge variant="outline">
																{job.validatedOutput.matches.length} visible match row(s)
															</Badge>
														</div>

														{job.validatedOutput.matches.length > 0 ? (
															<div className="mt-3 flex flex-wrap gap-2">
																{job.validatedOutput.matches.map((match) => (
																	<Badge key={`${job.id}-${match.matchOrder}`} variant="outline">
																		#{match.matchOrder} {match.mapName} {match.allyScore}-
																		{match.enemyScore}
																	</Badge>
																))}
															</div>
														) : null}
													</>
												);
											})()
										) : (
											<div className="space-y-3">
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="outline">
														Ally team {job.validatedOutput.allyTeam.length} player(s)
													</Badge>
													<Badge variant="outline">
														Enemy team {job.validatedOutput.enemyTeam.length} player(s)
													</Badge>
												</div>
												<div className="grid gap-3 lg:grid-cols-2">
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
															Ally team
														</p>
														<div className="mt-2 space-y-1 text-xs text-muted-foreground">
															{job.validatedOutput.allyTeam.length > 0 ? (
																job.validatedOutput.allyTeam.map((player, index) => (
																	<p key={`${job.id}-ally-${index}`}>
																		{formatScoreboardPlayerLine(player)}
																	</p>
																))
															) : (
																<p>No visible ally rows.</p>
															)}
														</div>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
															Enemy team
														</p>
														<div className="mt-2 space-y-1 text-xs text-muted-foreground">
															{job.validatedOutput.enemyTeam.length > 0 ? (
																job.validatedOutput.enemyTeam.map((player, index) => (
																	<p key={`${job.id}-enemy-${index}`}>
																		{formatScoreboardPlayerLine(player)}
																	</p>
																))
															) : (
																<p>No visible enemy rows.</p>
															)}
														</div>
													</div>
												</div>
											</div>
										)}

										{job.validatedOutput.warnings.length > 0 ? (
											<p className="mt-3 text-xs text-muted-foreground">
												Warnings: {job.validatedOutput.warnings.join(" | ")}
											</p>
										) : null}
									</div>
								) : null}

								{job.status === "completed" &&
								job.validatedOutput &&
								!revisionsByOcrJobId.has(job.id) &&
								!mapsByOcrJobId.has(job.id) &&
								!importedScoreboardJobIds.has(job.id) ? (
									<p className="mt-3 text-xs text-muted-foreground">
										This is unreviewed OCR extraction — use <strong>Review result</strong> to import
										it into the scrim record.
									</p>
								) : null}

								{job.confidenceFlags.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-2">
										{job.confidenceFlags.map((flag) => (
											<Badge key={`${job.id}-${flag}`} variant="outline">
												{formatConfidenceFlag(flag)}
											</Badge>
										))}
									</div>
								) : null}

								{job.providerModel ? (
									<p className="mt-3 text-xs text-muted-foreground">
										Provider: {job.providerName ?? "Unknown"} / {job.providerModel}
									</p>
								) : null}

								{job.errorMessage ? (
									<p className="mt-3 text-xs text-destructive">{job.errorMessage}</p>
								) : null}

								{(() => {
									const linkedRevisions = revisionsByOcrJobId.get(job.id);
									const linkedMaps = mapsByOcrJobId.get(job.id);
									const targetMap =
										job.screenshotType === "scoreboard" && job.scrimMapId
											? mapsById.get(job.scrimMapId)
											: undefined;
									if (!linkedRevisions?.length && !linkedMaps?.length && !targetMap) return null;
									return (
										<div className="mt-3 space-y-1 text-xs text-muted-foreground">
											{targetMap && !linkedMaps?.length ? (
												<p>
													Target map: {targetMap.mapOrder} — {targetMap.mapName}
												</p>
											) : null}
											{linkedRevisions?.map((revision) => (
												<p key={revision.id}>Used in revision #{revision.revisionNumber}</p>
											))}
											{linkedMaps?.map((map) => (
												<p key={map.id}>
													Scoreboard for map {map.mapOrder}: {map.mapName}
												</p>
											))}
										</div>
									);
								})()}
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
