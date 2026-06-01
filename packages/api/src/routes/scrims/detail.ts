import type { ScrimDetail, ScrimOcrJobRealtimePayload, ScrimSummary } from "@scrimflow/shared";
import { publishScrimEvent, publishTeamEvent } from "@/realtime/scrim-hub";
import { mapBaseScrimSummary, type ScrimRow, type ScrimSummaryRow, toIsoDate } from "./shared";

export function mapScrimSummary(scrim: ScrimSummaryRow): ScrimSummary {
	return mapBaseScrimSummary(scrim);
}

export function mapOcrJob(job: ScrimRow["ocrJobs"][number]): ScrimDetail["ocrJobs"][number] {
	return {
		id: job.id,
		scrimId: job.scrimId,
		screenshotType: job.screenshotType,
		scrimMapId: job.scrimMapId ?? null,
		imageUrl: job.imageUrl,
		status: job.status,
		progressStage: job.progressStage as ScrimDetail["ocrJobs"][number]["progressStage"],
		errorMessage: job.errorMessage ?? null,
		errorCode: job.errorCode ?? null,
		retryCount: job.retryCount,
		submittedByUserId: job.submittedByUserId,
		submittedByDisplayName: job.submittedBy?.displayName ?? null,
		providerName: job.providerName ?? null,
		providerModel: job.providerModel ?? null,
		promptVersion: job.promptVersion ?? null,
		runAfter: toIsoDate(job.runAfter),
		processingTimeMs: job.processingTimeMs ?? null,
		confidenceFlags: (job.confidenceFlags ??
			[]) as ScrimDetail["ocrJobs"][number]["confidenceFlags"],
		validatedOutput:
			(job.validatedOutput as ScrimDetail["ocrJobs"][number]["validatedOutput"]) ?? null,
		startedAt: toIsoDate(job.startedAt),
		completedAt: toIsoDate(job.completedAt),
		createdAt: job.createdAt.toISOString(),
		updatedAt: job.updatedAt.toISOString(),
	};
}

function mapOcrJobRealtimePayload(
	job: Pick<
		ScrimDetail["ocrJobs"][number],
		| "id"
		| "scrimId"
		| "status"
		| "progressStage"
		| "errorMessage"
		| "retryCount"
		| "processingTimeMs"
		| "updatedAt"
	>
): ScrimOcrJobRealtimePayload {
	return {
		jobId: job.id,
		scrimId: job.scrimId,
		status: job.status,
		progressStage: job.progressStage,
		errorMessage: job.errorMessage,
		retryCount: job.retryCount,
		processingTimeMs: job.processingTimeMs,
		updatedAt: job.updatedAt,
	};
}

export function getScrimParticipantTeamIds(scrim: {
	homeTeam: { id: string };
	awayTeam: { id: string } | null;
}) {
	return [scrim.homeTeam.id, scrim.awayTeam?.id ?? null].filter(
		(teamId): teamId is string => !!teamId
	);
}

export function getScrimParticipantTeamIdsFromIds(scrim: {
	homeTeamId: string;
	awayTeamId: string | null;
}) {
	return [scrim.homeTeamId, scrim.awayTeamId].filter((teamId): teamId is string => !!teamId);
}

export function publishScrimStatusChanged(
	scrimId: string,
	status: ScrimDetail["status"],
	options: {
		teamIds?: string[];
		changeType?: "created" | "status" | "result" | "ocr" | "conversation" | "dispute";
	} = {}
) {
	const occurredAt = new Date().toISOString();
	publishScrimEvent({
		scrimId,
		event: "scrim:status-changed",
		payload: { status, occurredAt },
	});

	for (const teamId of options.teamIds ?? []) {
		publishTeamEvent({
			teamId,
			event: "scrim:changed",
			payload: {
				scrimId,
				status,
				changeType: options.changeType ?? "status",
				occurredAt,
			},
		});
	}
}

export function publishOcrJobRealtimeUpdate(
	job: Pick<
		ScrimDetail["ocrJobs"][number],
		| "id"
		| "scrimId"
		| "status"
		| "progressStage"
		| "errorMessage"
		| "retryCount"
		| "processingTimeMs"
		| "updatedAt"
	>
) {
	publishScrimEvent({
		scrimId: job.scrimId,
		event: "scrim:ocr-job-updated",
		payload: {
			job: mapOcrJobRealtimePayload(job),
		},
	});
}

function mapScrimMap(
	map: ScrimRow["maps"][number],
	imageUrl: string | null = null
): ScrimDetail["maps"][number] {
	return {
		id: map.id,
		mapOrder: map.mapOrder,
		mapName: map.mapName,
		mapType: map.mapType as ScrimDetail["maps"][number]["mapType"],
		gameMode: map.gameMode as ScrimDetail["maps"][number]["gameMode"],
		durationSeconds: map.durationSeconds ?? null,
		result: map.result,
		homeScore: map.homeScore,
		awayScore: map.awayScore,
		ocrJobId: map.ocrJobId ?? null,
		imageUrl,
		players: map.playerStats.map((player) => ({
			id: player.id,
			side: player.side as ScrimDetail["maps"][number]["players"][number]["side"],
			userId: player.userId ?? null,
			teamId: player.teamId ?? null,
			playerName: player.playerName,
			hero: player.hero ?? null,
			role: player.role ?? null,
			eliminations: player.eliminations ?? null,
			assists: player.assists ?? null,
			deaths: player.deaths ?? null,
			damage: player.damage ?? null,
			healing: player.healing ?? null,
			mitigation: player.mitigation ?? null,
		})),
	};
}

function mapScrimResultRevision(
	revision: ScrimRow["resultRevisions"][number]
): ScrimDetail["resultRevisions"][number] {
	return {
		id: revision.id,
		revisionNumber: revision.revisionNumber,
		reportingTeamId: revision.reportingTeamId ?? null,
		reportingTeamName: revision.reportingTeam?.name ?? null,
		reportingTeamTag: revision.reportingTeam?.tag ?? null,
		submittedByUserId: revision.submittedByUserId ?? null,
		submittedByDisplayName: revision.submittedBy?.displayName ?? null,
		sourceOcrJobId: revision.sourceOcrJobId ?? null,
		homeMapScore: revision.homeMapScore,
		awayMapScore: revision.awayMapScore,
		startedAt: toIsoDate(revision.startedAt),
		endedAt: toIsoDate(revision.endedAt),
		snapshot: revision.snapshot as ScrimDetail["resultRevisions"][number]["snapshot"],
		changeSummary:
			revision.changeSummary as ScrimDetail["resultRevisions"][number]["changeSummary"],
		createdAt: revision.createdAt.toISOString(),
	};
}

export function mapScrimDetail(
	scrim: ScrimRow,
	mapImagesByName: Map<string, string | null> = new Map()
): ScrimDetail {
	return {
		...mapScrimSummary(scrim),
		confirmations: scrim.confirmations.map((confirmation) => ({
			id: confirmation.id,
			teamId: confirmation.teamId,
			teamName: confirmation.team.name,
			teamTag: confirmation.team.tag,
			status: confirmation.status,
			disputeReason: confirmation.disputeReason ?? null,
			confirmedByUserId: confirmation.confirmedByUserId ?? null,
			confirmedByDisplayName: confirmation.confirmedBy?.displayName ?? null,
			confirmedAt: toIsoDate(confirmation.confirmedAt),
			updatedAt: confirmation.updatedAt.toISOString(),
		})),
		ratingEvents: scrim.ratingEvents.map((event) => ({
			id: event.id,
			teamId: event.teamId,
			teamName: event.team.name,
			teamTag: event.team.tag,
			ratingBefore: event.ratingBefore,
			ratingAfter: event.ratingAfter,
			ratingDelta: event.ratingDelta,
			ratingDeviationBefore: event.ratingDeviationBefore ?? null,
			ratingDeviationAfter: event.ratingDeviationAfter ?? null,
			algorithmVersion: event.algorithmVersion,
			createdAt: event.createdAt.toISOString(),
		})),
		ocrJobs: scrim.ocrJobs.map(mapOcrJob),
		maps: scrim.maps.map((m) => mapScrimMap(m, mapImagesByName.get(m.mapName) ?? null)),
		resultRevisions: scrim.resultRevisions.map(mapScrimResultRevision),
		negotiationRevisions: scrim.negotiationRevisions.map((rev) => ({
			id: rev.id,
			action: rev.action as ScrimDetail["negotiationRevisions"][number]["action"],
			actorUserId: rev.actorUserId ?? null,
			actorDisplayName: rev.actor?.displayName ?? null,
			actorTeamId: rev.actorTeamId ?? null,
			actorTeamName: rev.actorTeam?.name ?? null,
			actorTeamTag: rev.actorTeam?.tag ?? null,
			priorScheduledAt: toIsoDate(rev.priorScheduledAt),
			proposedScheduledAt: toIsoDate(rev.proposedScheduledAt),
			priorConfig: (rev.priorConfig ??
				null) as ScrimDetail["negotiationRevisions"][number]["priorConfig"],
			proposedConfig: (rev.proposedConfig ??
				null) as ScrimDetail["negotiationRevisions"][number]["proposedConfig"],
			priorMessage: rev.priorMessage ?? null,
			proposedMessage: rev.proposedMessage ?? null,
			createdAt: rev.createdAt.toISOString(),
		})),
		dispute: {
			resolution: scrim.disputeResolution ?? null,
			resolvedByUserId: scrim.disputeResolvedByUserId ?? null,
			resolvedByDisplayName: scrim.disputeResolvedBy?.displayName ?? null,
			resolvedAt: toIsoDate(scrim.disputeResolvedAt),
			notes: scrim.disputeNotes ?? null,
			disputeResponse: scrim.disputeResponse ?? null,
			disputeRespondedAt: toIsoDate(scrim.disputeRespondedAt),
			disputeRespondedByDisplayName: scrim.disputeRespondedBy?.displayName ?? null,
		},
	};
}
