"use client";

import { Image01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
	OcrJobSummary,
	RealtimeEvent,
	ScrimMapSummary,
	ScrimResultRevisionSummary,
} from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { type ReactNode, startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatScrimTimestamp } from "@/lib/scrims/format";
import {
	ACTIVE_JOB_STATUSES,
	formatConfidenceFlag,
	getJobBadgeClass,
	getStageLabel,
	getStageProgress,
} from "@/lib/scrims/ocr-status";
import { cn } from "@/lib/utils";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { readApiPayload } from "./form-errors";
import { UploadScrimEvidenceDialog } from "./upload-scrim-evidence-dialog";

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

interface ScrimOcrJobsPanelProps {
	scrimId: string;
	jobs: OcrJobSummary[];
	canReportResult?: boolean;
	uploadDisabledReason?: string | null;
	resultRevisions?: ScrimResultRevisionSummary[];
	maps?: ScrimMapSummary[];
	reviewAction?: ReactNode;
}

export function ScrimOcrJobsPanel({
	scrimId,
	jobs,
	canReportResult = false,
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
		const loading = toast.loading("Re-queueing scan…");

		try {
			const response = await fetch(apiRoutes.scrims.retryOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to retry scan.", { id: loading });
				return;
			}

			toast.success("Scan re-queued.", { id: loading });
			startTransition(() => router.refresh());
		} catch {
			toast.error("Unable to reach the API server.", { id: loading });
		} finally {
			setRetryingJobId(null);
		}
	}

	async function handleSupersede(jobId: string) {
		if (supersedingJobId) return;
		setSupersedingJobId(jobId);
		const loading = toast.loading("Replacing scan…");

		try {
			const response = await fetch(apiRoutes.scrims.supersedeOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to replace scan.", { id: loading });
				return;
			}

			toast.success("Scan cleared — upload a new one.", { id: loading });
			startTransition(() => router.refresh());
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

	const gameHistoryJob =
		liveJobs.find((job) => job.screenshotType === "game_history" && job.status !== "superseded") ??
		null;
	const seriesActive = gameHistoryJob && ACTIVE_JOB_STATUSES.has(gameHistoryJob.status);
	const seriesRetryable =
		gameHistoryJob &&
		(gameHistoryJob.status === "failed" || gameHistoryJob.status === "requires_review");
	const seriesReplaceable = gameHistoryJob && !seriesActive;

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1.5">
						<CardTitle>Evidence and OCR</CardTitle>
						<CardDescription>
							Game-history scans draft the series for review. Scoreboard scans are reviewed and
							saved per map from the result data above.
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
								{gameHistoryJob ? getStageLabel(gameHistoryJob) : "No game history attached"}
							</p>
						</div>
						{gameHistoryJob ? (
							<Badge variant="outline" className={getJobBadgeClass(gameHistoryJob)}>
								{gameHistoryJob.status === "completed"
									? "Draft source"
									: getStageLabel(gameHistoryJob)}
							</Badge>
						) : null}
					</div>

					{gameHistoryJob ? (
						<div className="mt-3 space-y-2">
							{seriesActive ? (
								<Progress value={getStageProgress(gameHistoryJob.progressStage)} />
							) : null}
							{gameHistoryJob.validatedOutput?.screenshotType === "game_history" ? (
								<p className="text-xs text-muted-foreground">
									Found {gameHistoryJob.validatedOutput.matches.length} visible map row(s). Open the
									result editor to use this scan as a draft.
								</p>
							) : gameHistoryJob.status === "failed" ? (
								<p className="text-xs text-destructive">
									{gameHistoryJob.errorMessage ?? "The scan failed before maps could be read."}
								</p>
							) : (
								<p className="text-xs text-muted-foreground">Reading screenshot for map rows.</p>
							)}
							{canReportResult && (seriesRetryable || seriesReplaceable) ? (
								<div className="flex flex-wrap gap-1.5">
									{seriesRetryable ? (
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => handleRetry(gameHistoryJob.id)}
											disabled={retryingJobId === gameHistoryJob.id}
										>
											<HugeiconsIcon
												icon={RefreshIcon}
												strokeWidth={2}
												className="mr-1.5 size-3.5"
											/>
											Retry
										</Button>
									) : null}
									{seriesReplaceable ? (
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onClick={() => handleSupersede(gameHistoryJob.id)}
											disabled={supersedingJobId === gameHistoryJob.id}
										>
											Replace
										</Button>
									) : null}
								</div>
							) : null}
						</div>
					) : canReportResult ? (
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
								description="Upload match history or scoreboard screenshots to start the extraction pipeline."
								variant="inline"
							/>
						) : (
							<div className="space-y-2">
								{liveJobs.map((job) => {
									const active = ACTIVE_JOB_STATUSES.has(job.status);
									const linkedRevisions = revisionsByOcrJobId.get(job.id);
									const linkedMaps = mapsByOcrJobId.get(job.id);
									const isUnreviewedSeries =
										job.screenshotType === "game_history" &&
										(job.status === "completed" || job.status === "requires_review") &&
										!linkedRevisions?.length &&
										!linkedMaps?.length;
									return (
										<div
											key={job.id}
											className={cn("bg-card p-3", job.status === "superseded" && "opacity-60")}
										>
											<div className="flex flex-wrap items-center justify-between gap-2">
												<p className="text-sm font-semibold capitalize">
													{job.screenshotType.replace("_", " ")}
												</p>
												<Badge variant="outline" className={getJobBadgeClass(job)}>
													{getStageLabel(job)}
												</Badge>
											</div>

											<p className="mt-1 text-xs text-muted-foreground">
												{job.submittedByDisplayName ?? "Unknown user"} ·{" "}
												{formatScrimTimestamp(job.createdAt)}
												{job.processingTimeMs
													? ` · ${Math.round(job.processingTimeMs / 100) / 10}s`
													: ""}
											</p>

											{active ? (
												<Progress className="mt-2" value={getStageProgress(job.progressStage)} />
											) : null}

											{job.validatedOutput ? (
												<div className="mt-2 flex flex-wrap items-center gap-1.5">
													{job.validatedOutput.screenshotType === "game_history" ? (
														(() => {
															const series = deriveGameHistorySeriesScore(
																job.validatedOutput.matches
															);
															return (
																<>
																	<Badge variant="outline">
																		Series {series.home}-{series.away}
																	</Badge>
																	{job.validatedOutput.matches.map((match) => (
																		<Badge key={`${job.id}-${match.matchOrder}`} variant="outline">
																			{match.mapName} {match.allyScore}-{match.enemyScore}
																		</Badge>
																	))}
																</>
															);
														})()
													) : (
														<Badge variant="outline">
															{job.validatedOutput.allyTeam.length} ally ·{" "}
															{job.validatedOutput.enemyTeam.length} enemy rows
														</Badge>
													)}
												</div>
											) : null}

											{job.validatedOutput && job.validatedOutput.warnings.length > 0 ? (
												<p className="mt-2 text-xs text-muted-foreground">
													{job.validatedOutput.warnings.join(" · ")}
												</p>
											) : null}

											{job.confidenceFlags.length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-1.5">
													{job.confidenceFlags.map((flag) => (
														<Badge key={`${job.id}-${flag}`} variant="outline">
															{formatConfidenceFlag(flag)}
														</Badge>
													))}
												</div>
											) : null}

											{job.errorMessage && job.status === "failed" ? (
												<p className="mt-2 text-xs text-destructive">{job.errorMessage}</p>
											) : null}

											{isUnreviewedSeries ? (
												<p className="mt-2 text-xs text-muted-foreground">
													Unreviewed — use <strong>Review result</strong> to submit it as the
													result.
												</p>
											) : null}

											{linkedRevisions?.length || linkedMaps?.length ? (
												<p className="mt-2 text-xs text-muted-foreground">
													{linkedMaps?.length
														? `Stats for map ${linkedMaps.map((m) => m.mapOrder).join(", ")}`
														: `Used in revision #${linkedRevisions?.[0]?.revisionNumber}`}
												</p>
											) : null}

											<Button
												type="button"
												variant="link"
												size="xs"
												onClick={() => handleOpenEvidence(job.id)}
												disabled={!!fetchingEvidenceJobId}
												className="mt-1 h-auto justify-start p-0 text-xs text-muted-foreground"
											>
												{fetchingEvidenceJobId === job.id ? "Opening…" : "Open uploaded screenshot"}
											</Button>
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
