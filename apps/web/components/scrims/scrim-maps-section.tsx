"use client";

import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { OcrJobSummary, ScrimDetail } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import {
	deriveMapScoreboardState,
	getStageProgress,
	type MapScoreboardState,
} from "@/lib/scrims/ocr-status";
import { cn } from "@/lib/utils";
import { readApiPayload } from "./form-errors";
import { type RosterLinkOption, ScrimMapScoreboardDialog } from "./scrim-map-scoreboard-dialog";
import { UploadScrimEvidenceDialog } from "./upload-scrim-evidence-dialog";

function formatOptionalStat(value: number | null) {
	return value === null ? "—" : String(value);
}

const SCOREBOARD_CHIP: Record<MapScoreboardState, { label: string; className: string }> = {
	none: { label: "No scoreboard", className: STATUS_BADGE_CLASSES.inactive },
	processing: { label: "Scanning", className: STATUS_BADGE_CLASSES.underReview },
	failed: { label: "Scan failed", className: STATUS_BADGE_CLASSES.blocked },
	ready: { label: "Ready to review", className: STATUS_BADGE_CLASSES.pending },
	saved: { label: "Stats saved", className: STATUS_BADGE_CLASSES.active },
};

interface ScrimMapsSectionProps {
	maps: ScrimDetail["maps"];
	scrimId: string;
	ocrJobs?: OcrJobSummary[];
	reportingTeamId: string;
	reportingTeamSide: "home" | "away";
	ownRoster?: RosterLinkOption[];
	opponentRoster?: RosterLinkOption[];
	canManage?: boolean;
	canEditPlayerStats?: boolean;
	uploadDisabledReason?: string | null;
}

export function ScrimMapsSection({
	maps,
	scrimId,
	ocrJobs = [],
	reportingTeamId,
	reportingTeamSide,
	ownRoster = [],
	opponentRoster = [],
	canManage = false,
	canEditPlayerStats = false,
	uploadDisabledReason = null,
}: ScrimMapsSectionProps) {
	const router = useRouter();
	const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
	const [supersedingJobId, setSupersedingJobId] = useState<string | null>(null);

	async function handleRetry(jobId: string) {
		if (retryingJobId) return;
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
			startTransition(() => router.refresh());
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
					The saved map record from the latest submitted result. Review each map&apos;s scoreboard
					to attach player stats — this never changes the agreed score.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{maps.length === 0 ? (
					<div className="bg-muted/30 p-3">
						<p className="text-sm font-semibold">No submitted map data yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							The series can still be score-only. Add maps in the result editor when per-map detail
							matters.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{maps.map((map) => {
							const { state, job } = deriveMapScoreboardState(map, ocrJobs);
							const chip = SCOREBOARD_CHIP[state];
							return (
								<div key={map.id} className="bg-muted/30 p-3">
									<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)]">
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
												<Badge variant="outline" className={STATUS_BADGE_CLASSES.completed}>
													Final map
												</Badge>
											</div>
											<p className="mt-2 text-xs text-muted-foreground">
												{map.players.length > 0
													? `${map.players.length} player stat row(s) saved for this map.`
													: "Score-only map. Attach a scoreboard to record player stats."}
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

										<div className="bg-card p-3">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
													Scoreboard
												</p>
												<Badge variant="outline" className={cn("shrink-0", chip.className)}>
													{chip.label}
												</Badge>
											</div>

											{state === "processing" && job ? (
												<div className="mt-3 space-y-2">
													<Progress value={getStageProgress(job.progressStage)} />
													<p className="text-xs text-muted-foreground">Reading player stats...</p>
												</div>
											) : (
												<div className="mt-3 space-y-2">
													<p className="text-xs text-muted-foreground">
														{state === "saved"
															? "Player stats are saved. Open to review the screenshot or edit rows."
															: state === "ready"
																? "Scan is ready. Review the extracted rows and save them to this map."
																: state === "failed"
																	? (job?.errorMessage ?? "This scoreboard scan failed.")
																	: "No scoreboard attached. Upload one to scan player stats, or enter them manually."}
													</p>

													<div className="flex flex-wrap gap-1.5">
														{state === "ready" || state === "saved" ? (
															<ScrimMapScoreboardDialog
																scrimId={scrimId}
																map={map}
																reportingTeamId={reportingTeamId}
																reportingTeamSide={reportingTeamSide}
																ownRoster={ownRoster}
																opponentRoster={opponentRoster}
																scoreboardJob={job}
																canEdit={canEditPlayerStats}
															>
																<Button type="button" size="sm" variant="outline">
																	{state === "saved" ? "View / edit stats" : "Review & save stats"}
																</Button>
															</ScrimMapScoreboardDialog>
														) : null}

														{/* No live scan → managers can attach one. */}
														{canEditPlayerStats && !job ? (
															<UploadScrimEvidenceDialog
																scrimId={scrimId}
																screenshotType="scoreboard"
																targetMapId={map.id}
																targetMapLabel={`Map ${map.mapOrder}: ${map.mapName}`}
															>
																<Button type="button" size="sm" variant="outline">
																	{state === "saved" ? "Add scoreboard scan" : "Add scoreboard"}
																</Button>
															</UploadScrimEvidenceDialog>
														) : null}

														{state === "none" && canEditPlayerStats ? (
															<ScrimMapScoreboardDialog
																scrimId={scrimId}
																map={map}
																reportingTeamId={reportingTeamId}
																reportingTeamSide={reportingTeamSide}
																ownRoster={ownRoster}
																opponentRoster={opponentRoster}
																scoreboardJob={null}
																canEdit={canEditPlayerStats}
															>
																<Button type="button" size="sm" variant="ghost">
																	Enter manually
																</Button>
															</ScrimMapScoreboardDialog>
														) : null}

														{state === "failed" && canManage && canEditPlayerStats && job ? (
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

														{canManage && canEditPlayerStats && job ? (
															<Button
																type="button"
																size="sm"
																variant="ghost"
																onClick={() => handleSupersede(job.id)}
																disabled={!!supersedingJobId}
															>
																Replace
															</Button>
														) : null}

														{state === "none" && !canEditPlayerStats ? (
															<p className="text-xs text-muted-foreground">
																{uploadDisabledReason ?? "Scoreboard uploads are not available."}
															</p>
														) : null}
													</div>
												</div>
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
