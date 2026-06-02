"use client";

import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { OcrJobSummary, ScrimDetail } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { readApiPayload } from "./form-errors";
import { UploadScrimEvidenceDialog } from "./upload-scrim-evidence-dialog";

const ACTIVE_JOB_STATUSES = new Set(["queued", "processing"]);

function formatOptionalStat(value: number | null) {
	return value === null ? "—" : String(value);
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
	if (job.status === "completed") return "Ready to review";
	if (job.status === "superseded") return "Superseded";
	if (job.progressStage === "claimed") return "Claimed";
	if (job.progressStage === "preprocessing") return "Preprocessing";
	if (job.progressStage === "provider_request") return "Calling Gemini";
	if (job.progressStage === "validating") return "Validating";
	return "Queued";
}

function getStageProgress(stage: OcrJobSummary["progressStage"]) {
	if (stage === "claimed") return 20;
	if (stage === "preprocessing") return 40;
	if (stage === "provider_request") return 68;
	if (stage === "validating") return 88;
	if (stage === "requires_review" || stage === "completed" || stage === "failed") return 100;
	return 8;
}

interface ScrimMapsSectionProps {
	maps: ScrimDetail["maps"];
	resultRevisions?: ScrimDetail["resultRevisions"];
	scrimId?: string;
	ocrJobs?: OcrJobSummary[];
	canManage?: boolean;
	canUploadEvidence?: boolean;
	uploadDisabledReason?: string | null;
}

export function ScrimMapsSection({
	maps,
	resultRevisions = [],
	scrimId = "",
	ocrJobs = [],
	canManage = false,
	canUploadEvidence = false,
	uploadDisabledReason = null,
}: ScrimMapsSectionProps) {
	const router = useRouter();
	const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
	const [supersedingJobId, setSupersedingJobId] = useState<string | null>(null);
	const latestRevision =
		resultRevisions.length > 0
			? resultRevisions.reduce((a, b) => (b.revisionNumber > a.revisionNumber ? b : a))
			: null;
	const scoreboardMapOrders = new Set(
		latestRevision?.snapshot.maps
			.filter((map) => !!map.scoreboardOcrJobId)
			.map((map) => map.mapOrder) ?? []
	);
	const scoreboardJobByMapId = new Map<string, OcrJobSummary>();
	for (const job of ocrJobs) {
		if (job.screenshotType !== "scoreboard" || !job.scrimMapId || job.status === "superseded")
			continue;
		const existing = scoreboardJobByMapId.get(job.scrimMapId);
		if (!existing || job.createdAt > existing.createdAt) {
			scoreboardJobByMapId.set(job.scrimMapId, job);
		}
	}

	async function handleRetry(jobId: string) {
		if (retryingJobId || !scrimId) return;
		setRetryingJobId(jobId);
		const loading = toast.loading("Re-queueing scoreboard scan...");

		try {
			const response = await fetch(apiRoutes.scrims.retryOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to retry scoreboard scan.", { id: loading });
				return;
			}

			toast.success("Scoreboard scan re-queued.", { id: loading });
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
		if (supersedingJobId || !scrimId) return;
		setSupersedingJobId(jobId);
		const loading = toast.loading("Preparing scoreboard replacement...");

		try {
			const response = await fetch(apiRoutes.scrims.supersedeOcrJob(scrimId, jobId), {
				method: "POST",
				credentials: "include",
			});
			const payload = await readApiPayload<OcrJobSummary>(response);

			if (!response.ok || !payload.data) {
				toast.error(payload.error ?? "Unable to replace scoreboard scan.", { id: loading });
				return;
			}

			toast.success("Scoreboard scan marked for replacement.", { id: loading });
			startTransition(() => {
				router.refresh();
			});
		} catch {
			toast.error("Unable to reach the API server.", { id: loading });
		} finally {
			setSupersedingJobId(null);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Submitted result data</CardTitle>
				<CardDescription>
					The saved map record from the latest submitted result package.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{maps.length === 0 ? (
					<div className="bg-muted/30 p-3">
						<p className="text-sm font-semibold">No submitted map data yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							The series can still be score-only. Add maps in the workbench when per-map detail
							matters.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{maps.map((map) => {
							const hasScoreboardEvidence = scoreboardMapOrders.has(map.mapOrder);
							const scoreboardJob = scoreboardJobByMapId.get(map.id);
							const scoreboardActive =
								scoreboardJob && ACTIVE_JOB_STATUSES.has(scoreboardJob.status);
							const scoreboardBadgeLabel = hasScoreboardEvidence
								? "Verified stats"
								: scoreboardJob
									? getStageLabel(scoreboardJob)
									: "No scoreboard attached";
							const scoreboardBadgeClass = hasScoreboardEvidence
								? STATUS_BADGE_CLASSES.active
								: scoreboardJob
									? getJobBadgeClass(scoreboardJob)
									: STATUS_BADGE_CLASSES.inactive;
							return (
								<div key={map.id} className="bg-muted/30 p-3">
									<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.5fr)]">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold">
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
												<div className="flex flex-wrap gap-1.5">
													<Badge variant="outline" className={STATUS_BADGE_CLASSES.completed}>
														Final map
													</Badge>
													{map.players.length > 0 && !hasScoreboardEvidence ? (
														<Badge variant="outline" className={STATUS_BADGE_CLASSES.open}>
															Player stats saved
														</Badge>
													) : null}
												</div>
											</div>
											<p className="mt-2 text-xs text-muted-foreground">
												{hasScoreboardEvidence
													? `${map.players.length} linked stat row(s) saved from scoreboard evidence.`
													: map.players.length > 0
														? `${map.players.length} player row(s) saved for this map.`
														: "Score-only map. Attach a scoreboard only when player stats matter."}
											</p>

											{map.players.length > 0 ? (
												<details className="mt-3">
													<summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
														View {map.players.length} player row(s)
													</summary>
													<div className="mt-2 divide-y divide-border">
														{map.players.map((player) => (
															<div key={player.id} className="py-2 text-xs first:pt-0 last:pb-0">
																<div className="flex flex-wrap items-center justify-between gap-2">
																	<p className="font-semibold">
																		{player.playerName}
																		<span className="ml-2 font-normal text-muted-foreground">
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
												</details>
											) : null}
										</div>

										<div className="bg-card p-3 lg:border-l-0">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
													Scoreboard
												</p>
												<Badge variant="outline" className={cn("shrink-0", scoreboardBadgeClass)}>
													{scoreboardBadgeLabel}
												</Badge>
											</div>
											{scoreboardActive && scoreboardJob ? (
												<div className="mt-3 space-y-2">
													<Progress value={getStageProgress(scoreboardJob.progressStage)} />
													<p className="text-xs text-muted-foreground">Reading player stats...</p>
												</div>
											) : scoreboardJob ? (
												<div className="mt-3 space-y-2">
													<p className="text-xs text-muted-foreground">
														{hasScoreboardEvidence
															? "Applied in the latest submitted package."
															: scoreboardJob.status === "completed" ||
																	scoreboardJob.status === "requires_review"
																? "Ready to review. Open the workbench to review and apply rows."
																: scoreboardJob.status === "failed"
																	? (scoreboardJob.errorMessage ?? "This scoreboard scan failed.")
																	: "Review or replace this scoreboard evidence."}
													</p>
													{canManage && canUploadEvidence ? (
														<div className="flex flex-wrap gap-1.5">
															{scoreboardJob.status === "failed" ||
															scoreboardJob.status === "requires_review" ? (
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => handleRetry(scoreboardJob.id)}
																	disabled={retryingJobId === scoreboardJob.id}
																>
																	<HugeiconsIcon
																		icon={RefreshIcon}
																		strokeWidth={2}
																		className="mr-1.5 size-3.5"
																	/>
																	Retry
																</Button>
															) : null}
															<Button
																type="button"
																size="sm"
																variant="ghost"
																onClick={() => handleSupersede(scoreboardJob.id)}
																disabled={!!supersedingJobId}
															>
																Replace
															</Button>
														</div>
													) : null}
												</div>
											) : canUploadEvidence && scrimId ? (
												<UploadScrimEvidenceDialog
													scrimId={scrimId}
													screenshotType="scoreboard"
													targetMapId={map.id}
													targetMapLabel={`Map ${map.mapOrder}: ${map.mapName}`}
												>
													<Button type="button" size="sm" variant="outline" className="mt-3 w-full">
														Add scoreboard
													</Button>
												</UploadScrimEvidenceDialog>
											) : (
												<p className="mt-3 text-xs text-muted-foreground">
													{uploadDisabledReason ?? "Scoreboard uploads are not available."}
												</p>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
