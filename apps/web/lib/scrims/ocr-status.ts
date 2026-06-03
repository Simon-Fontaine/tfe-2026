import type { OcrJobSummary, ScrimMapSummary } from "@scrimflow/shared";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";

/** OCR job statuses that mean the worker is still actively processing. */
export const ACTIVE_JOB_STATUSES = new Set<OcrJobSummary["status"]>(["queued", "processing"]);

/** Completed/requires_review jobs carry a `validatedOutput` to review/apply. */
export function isReviewableJob(job: OcrJobSummary) {
	return job.status === "completed" || job.status === "requires_review";
}

export function getJobBadgeClass(job: OcrJobSummary) {
	if (job.status === "failed") return STATUS_BADGE_CLASSES.blocked;
	if (job.status === "completed") return STATUS_BADGE_CLASSES.completed;
	if (job.status === "requires_review") return STATUS_BADGE_CLASSES.pending;
	if (job.status === "superseded") return STATUS_BADGE_CLASSES.inactive;
	return STATUS_BADGE_CLASSES.underReview;
}

export function getStageLabel(job: OcrJobSummary) {
	if (job.status === "failed") return "Failed";
	if (job.status === "requires_review") return "Requires review";
	if (job.status === "completed") return "Ready to review";
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

export function getStageProgress(stage: OcrJobSummary["progressStage"]) {
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

export function formatConfidenceFlag(flag: string) {
	return flag.replaceAll("_", " ");
}

/** Most recent non-superseded scoreboard job for a map, if any. */
export function latestScoreboardJobForMap(mapId: string, jobs: OcrJobSummary[]) {
	let latest: OcrJobSummary | null = null;
	for (const job of jobs) {
		if (job.screenshotType !== "scoreboard" || job.scrimMapId !== mapId) continue;
		if (job.status === "superseded") continue;
		if (!latest || job.createdAt > latest.createdAt) latest = job;
	}
	return latest;
}

/** Coarse per-map scoreboard sub-state the maps UI keys its affordances off of. */
export type MapScoreboardState = "none" | "processing" | "failed" | "ready" | "saved";

export function deriveMapScoreboardState(
	map: ScrimMapSummary,
	jobs: OcrJobSummary[]
): { state: MapScoreboardState; job: OcrJobSummary | null } {
	const job = latestScoreboardJobForMap(map.id, jobs);

	if (job && ACTIVE_JOB_STATUSES.has(job.status)) return { state: "processing", job };
	if (job && job.status === "failed") return { state: "failed", job };

	// A ready scan not yet applied to this map needs review, even if stats exist.
	if (job && isReviewableJob(job) && map.ocrJobId !== job.id) return { state: "ready", job };

	if (map.players.length > 0) return { state: "saved", job };
	if (job && isReviewableJob(job)) return { state: "ready", job };
	return { state: "none", job: null };
}
