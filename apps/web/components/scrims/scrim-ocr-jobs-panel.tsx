"use client";

import {
	Calendar03Icon,
	Image01Icon,
	LinkSquare02Icon,
	RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
	OcrJobSummary,
	RealtimeEvent,
	ScrimMapSummary,
	ScrimResultRevisionSummary,
} from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { type ReactNode, startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes } from "@/lib/routes";
import { formatScrimTimestamp } from "@/lib/scrims/format";
import { cn } from "@/lib/utils";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { readApiPayload } from "./form-errors";
import { UploadScrimEvidenceDialog } from "./upload-scrim-evidence-dialog";

const ACTIVE_JOB_STATUSES = new Set(["queued", "processing"]);

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
	reviewAction?: ReactNode;
}

export function ScrimOcrJobsPanel({
	scrimId,
	jobs,
	canManage,
	canUploadEvidence = false,
	uploadDisabledReason = null,
	resultRevisions = [],
	maps = [],
	reviewAction = null,
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

		function handleRealtimeEvent(event: RealtimeEvent) {
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

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1.5">
						<CardTitle>Evidence and OCR</CardTitle>
						<CardDescription>
							Scans are draft assistance — maps, stats, and evidence become official only when the
							result package is submitted.
						</CardDescription>
					</div>
					{reviewAction}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="bg-muted/30 p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
						Game-history screenshots draft the map list and scores but save nothing until you submit
						the package.
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
							<Button type="button" size="sm" className="mt-3">
								Upload game history
							</Button>
						</UploadScrimEvidenceDialog>
					) : (
						<p className="mt-3 text-xs text-muted-foreground">
							{uploadDisabledReason ?? "Evidence uploads are not available for this scrim."}
						</p>
					)}
				</div>

				<details className="bg-muted/30 p-3">
					<summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						OCR job history ({liveJobs.length})
					</summary>
					<div className="mt-3">
						{liveJobs.length === 0 ? (
							<EmptyStateBlock
								icon={Image01Icon}
								title="No evidence uploaded yet"
								description="Upload match history or scoreboard screenshots to start the extraction pipeline for this scrim."
								variant="inline"
							/>
						) : (
							<div className="space-y-3">
								{liveJobs.map((job) => {
									const superseded = job.status === "superseded";
									return (
										<div key={job.id} className={cn("bg-card p-3", superseded && "opacity-60")}>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="min-w-0">
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
														<HugeiconsIcon
															icon={Calendar03Icon}
															strokeWidth={2}
															className="size-3.5"
														/>
														<span>Queued {formatScrimTimestamp(job.createdAt)}</span>
													</div>
													<div className="flex items-center gap-2">
														<HugeiconsIcon
															icon={LinkSquare02Icon}
															strokeWidth={2}
															className="size-3.5"
														/>
														<span>Retry count {job.retryCount}</span>
													</div>
													<div className="flex items-center gap-2">
														<span>
															{job.processingTimeMs
																? `${Math.round(job.processingTimeMs / 100) / 10}s processing time`
																: job.runAfter
																	? `Run after ${formatScrimTimestamp(job.runAfter)}`
																	: "Waiting for worker"}
														</span>
													</div>
													<Button
														type="button"
														variant="link"
														size="xs"
														onClick={() => handleOpenEvidence(job.id)}
														disabled={!!fetchingEvidenceJobId}
														className="h-auto justify-start p-0 text-xs text-muted-foreground"
													>
														{fetchingEvidenceJobId === job.id
															? "Opening…"
															: "Open uploaded screenshot"}
													</Button>
												</div>
											</div>

											{job.validatedOutput ? (
												<div className="mt-3 bg-muted/40 p-3">
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
																				<Badge
																					key={`${job.id}-${match.matchOrder}`}
																					variant="outline"
																				>
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
																	<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
																	<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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

											{(job.status === "completed" || job.status === "requires_review") &&
											job.validatedOutput &&
											!revisionsByOcrJobId.has(job.id) &&
											!mapsByOcrJobId.has(job.id) &&
											!importedScoreboardJobIds.has(job.id) ? (
												<p className="mt-3 text-xs text-muted-foreground">
													This is unreviewed OCR extraction — use <strong>Review result</strong> to
													import it into the scrim record.
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
												if (!linkedRevisions?.length && !linkedMaps?.length && !targetMap)
													return null;
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
									);
								})}
							</div>
						)}
					</div>
				</details>
			</CardContent>
		</Card>
	);
}
