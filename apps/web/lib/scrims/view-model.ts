import type {
	ScrimConfirmationSummary,
	ScrimDetail,
	ScrimDisputeResolution,
} from "@scrimflow/shared";

/**
 * Coarse lifecycle stage the detail UI keys its layout off of. Derived from the
 * scrim status plus whether a reviewed result exists yet.
 */
export type ScrimStage =
	| "negotiation"
	| "reporting"
	| "awaiting_confirmation"
	| "disputed"
	| "settled"
	| "cancelled";

/** The single most important thing the current viewer can do right now. */
export type ScrimPrimaryAction =
	| "report_result"
	| "review_confirmation"
	| "respond_dispute"
	| "resolve_dispute"
	| "none";

export type ScrimDetailTab = "overview" | "result" | "confirmations" | "activity";

export interface ScrimViewer {
	teamId: string;
	canManage: boolean;
	orgRole: string | null;
}

export interface ScrimViewModel {
	stage: ScrimStage;
	primaryAction: ScrimPrimaryAction;
	nextStepLabel: string;
	packageState: string;
	stageHeadline: string;
	stageDescription: string;

	canReportResult: boolean;
	canReviewConfirmation: boolean;
	canRespondToDispute: boolean;
	canResolveDispute: boolean;
	canUploadEvidence: boolean;
	uploadDisabledReason: string | null;

	currentConfirmation: ScrimConfirmationSummary | null;
	latestRevision: ScrimDetail["resultRevisions"][number] | null;
	disputeResolution: ScrimDisputeResolution | null;

	reviewedMapCount: number;
	mapsWithStatsCount: number;
	activeOcrJobCount: number;
	latestRevisionScoreboardCount: number;

	showResultTab: boolean;
	showConfirmationsTab: boolean;
	defaultTab: ScrimDetailTab;
}

function getUploadDisabledReason({
	canManage,
	hasOpponent,
	status,
}: {
	canManage: boolean;
	hasOpponent: boolean;
	status: ScrimDetail["status"];
}) {
	if (!canManage) return "Only team managers can upload match evidence.";
	if (!hasOpponent) return "Add an opponent before uploading result evidence.";
	if (status === "pending") return "Evidence opens after the scrim is accepted or started.";
	if (status === "cancelled") return "Cancelled scrims cannot accept new evidence.";
	if (status === "completed") return "This result package is locked after both teams confirm.";
	return null;
}

function deriveStage(scrim: ScrimDetail): ScrimStage {
	switch (scrim.status) {
		case "cancelled":
			return "cancelled";
		case "completed":
			return "settled";
		case "disputed":
			return "disputed";
		case "awaiting_confirmation":
			return "awaiting_confirmation";
		case "accepted":
		case "scheduled":
		case "in_progress":
			return "reporting";
		default:
			return "negotiation";
	}
}

const STAGE_COPY: Record<ScrimStage, { headline: string; description: string }> = {
	negotiation: {
		headline: "Negotiating the matchup",
		description:
			"Lock in the opponent, schedule, and format. Result reporting opens once the scrim is accepted.",
	},
	reporting: {
		headline: "Ready to play and report",
		description:
			"After the match, build one result package — maps are the work units and screenshots stay as draft evidence until you submit.",
	},
	awaiting_confirmation: {
		headline: "Awaiting confirmation",
		description:
			"A result has been reported. Both teams confirm the same outcome before ratings change.",
	},
	disputed: {
		headline: "Result disputed",
		description:
			"The teams disagree on the outcome. The reporting team can respond and an org admin makes the final call.",
	},
	settled: {
		headline: "Result settled",
		description:
			"Both teams confirmed the result. Ratings have been applied and the record is locked.",
	},
	cancelled: {
		headline: "Scrim cancelled",
		description: "This matchup was cancelled. Request a new scrim from the queue to play again.",
	},
};

export function deriveScrimViewModel(scrim: ScrimDetail, viewer: ScrimViewer): ScrimViewModel {
	const { status } = scrim;
	const hasOpponent = !!scrim.awayTeam;
	const resultEditable = status !== "pending" && status !== "cancelled" && status !== "completed";

	const currentConfirmation =
		scrim.confirmations.find((confirmation) => confirmation.teamId === viewer.teamId) ?? null;

	const latestRevision =
		scrim.resultRevisions.length > 0
			? scrim.resultRevisions.reduce((a, b) => (b.revisionNumber > a.revisionNumber ? b : a))
			: null;
	const reportingTeamFromLastRevision = latestRevision?.reportingTeamId ?? null;

	const canReportResult = viewer.canManage && hasOpponent && resultEditable;
	const canResolveDispute =
		status === "disputed" && (viewer.orgRole === "owner" || viewer.orgRole === "admin");
	const canRespondToDispute =
		viewer.canManage && status === "disputed" && viewer.teamId === reportingTeamFromLastRevision;
	const canReviewConfirmation =
		viewer.canManage &&
		!canRespondToDispute &&
		(status === "awaiting_confirmation" || status === "disputed");
	const canUploadEvidence = viewer.canManage && hasOpponent && resultEditable;
	const uploadDisabledReason = getUploadDisabledReason({
		canManage: viewer.canManage,
		hasOpponent,
		status,
	});

	const disputeResolution = scrim.dispute.resolution ?? (status === "disputed" ? "pending" : null);

	const reviewedMapCount = scrim.maps.length;
	const mapsWithStatsCount = scrim.maps.filter((map) => map.players.length > 0).length;
	const activeOcrJobCount = scrim.ocrJobs.filter(
		(job) => job.status === "queued" || job.status === "processing"
	).length;
	const latestRevisionScoreboardCount =
		latestRevision?.snapshot.maps.filter((map) => !!map.scoreboardOcrJobId).length ?? 0;

	const packageState =
		status === "completed"
			? "Locked"
			: status === "awaiting_confirmation"
				? "Awaiting confirmation"
				: status === "disputed"
					? "Disputed"
					: reviewedMapCount > 0
						? "Draft ready"
						: "Draft not started";

	const primaryAction: ScrimPrimaryAction = canResolveDispute
		? "resolve_dispute"
		: canRespondToDispute
			? "respond_dispute"
			: canReviewConfirmation
				? "review_confirmation"
				: canReportResult
					? "report_result"
					: "none";

	const nextStepLabel =
		primaryAction === "resolve_dispute"
			? "Resolve the dispute"
			: primaryAction === "respond_dispute"
				? "Respond to the dispute"
				: primaryAction === "review_confirmation"
					? "Review opponent result"
					: primaryAction === "report_result"
						? reviewedMapCount > 0
							? "Review and submit package"
							: "Build the result package"
						: status === "completed"
							? "Review final record"
							: "Follow scrim progress";

	const stage = deriveStage(scrim);

	const hasResultData =
		reviewedMapCount > 0 || scrim.ocrJobs.length > 0 || scrim.resultRevisions.length > 0;
	const showResultTab = canUploadEvidence || hasResultData;
	const showConfirmationsTab =
		scrim.resultRevisions.length > 0 ||
		status === "awaiting_confirmation" ||
		status === "disputed" ||
		status === "completed" ||
		scrim.confirmations.some((confirmation) => confirmation.status !== "pending");

	const defaultTab: ScrimDetailTab =
		(primaryAction === "review_confirmation" ||
			primaryAction === "respond_dispute" ||
			primaryAction === "resolve_dispute") &&
		showConfirmationsTab
			? "confirmations"
			: primaryAction === "report_result" && showResultTab
				? "result"
				: "overview";

	return {
		stage,
		primaryAction,
		nextStepLabel,
		packageState,
		stageHeadline: STAGE_COPY[stage].headline,
		stageDescription: STAGE_COPY[stage].description,

		canReportResult,
		canReviewConfirmation,
		canRespondToDispute,
		canResolveDispute,
		canUploadEvidence,
		uploadDisabledReason,

		currentConfirmation,
		latestRevision,
		disputeResolution,

		reviewedMapCount,
		mapsWithStatsCount,
		activeOcrJobCount,
		latestRevisionScoreboardCount,

		showResultTab,
		showConfirmationsTab,
		defaultTab,
	};
}
