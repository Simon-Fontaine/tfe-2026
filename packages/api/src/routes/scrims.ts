import {
	ConfirmScrimSchema,
	CreateScrimOcrJobSchema,
	CreateScrimSchema,
	type JsonValue,
	type OcrGameHistoryExtractedResult,
	ResolveScrimDisputeSchema,
	RespondToScrimSchema,
	type ScrimConfirmationStatus,
	type ScrimDetail,
	type ScrimOcrJobRealtimePayload,
	type ScrimResultChangeSummary,
	type ScrimResultDiffBasis,
	type ScrimResultRevisionSnapshot,
	type ScrimSummary,
	SubmitScrimResultSchema,
} from "@scrimflow/shared";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	ocrJobTable,
	scrimConfirmationTable,
	scrimMapTable,
	scrimPlayerStatTable,
	scrimResultRevisionTable,
	scrimTable,
	teamRatingEventTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { publishScrimEvent } from "@/realtime/scrim-hub";
import { extractErrors } from "@/routes/auth/utils";
import { ensureScrimConversationLifecycle } from "@/utils/chat";
import { verifyOrgManager } from "@/utils/org";
import { applyCompletedScrimRating } from "@/utils/rating";
import {
	getTeamAccessContext,
	isUserOnTeam,
	listTeamAdminUserIds,
	verifyTeamManager,
} from "@/utils/team";

const scrimRoutes = new Hono<AuthEnv>();
const publicScrimRoutes = new Hono<AuthEnv>();

const PUBLIC_SCRIM_STATUSES = [
	"scheduled",
	"in_progress",
	"awaiting_confirmation",
	"completed",
	"disputed",
] as const;

const TEAM_VIEWABLE_STATUSES = ["active", "benched", "trial"] as const;

class ScrimWorkflowError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = "ScrimWorkflowError";
	}
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function findScrimWithRelations(scrimId: string) {
	return db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		with: {
			homeTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: {
						columns: { name: true },
					},
				},
			},
			awayTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: {
						columns: { name: true },
					},
				},
			},
			createdBy: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			disputeResolvedBy: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			confirmations: {
				columns: {
					id: true,
					teamId: true,
					status: true,
					disputeReason: true,
					confirmedByUserId: true,
					confirmedAt: true,
					updatedAt: true,
				},
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
					confirmedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
			},
			ratingEvents: {
				columns: {
					id: true,
					teamId: true,
					ratingBefore: true,
					ratingAfter: true,
					ratingDelta: true,
					ratingDeviationBefore: true,
					ratingDeviationAfter: true,
					createdAt: true,
				},
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
				},
				orderBy: [asc(teamRatingEventTable.createdAt)],
			},
			resultRevisions: {
				columns: {
					id: true,
					revisionNumber: true,
					reportingTeamId: true,
					submittedByUserId: true,
					sourceOcrJobId: true,
					homeMapScore: true,
					awayMapScore: true,
					startedAt: true,
					endedAt: true,
					snapshot: true,
					changeSummary: true,
					createdAt: true,
				},
				with: {
					reportingTeam: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
					submittedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
				orderBy: [desc(scrimResultRevisionTable.revisionNumber)],
			},
			maps: {
				columns: {
					id: true,
					mapOrder: true,
					mapName: true,
					mapType: true,
					gameMode: true,
					durationSeconds: true,
					result: true,
					homeScore: true,
					awayScore: true,
					ocrJobId: true,
				},
				with: {
					playerStats: {
						columns: {
							id: true,
							side: true,
							userId: true,
							teamId: true,
							playerName: true,
							hero: true,
							role: true,
							eliminations: true,
							assists: true,
							deaths: true,
							damage: true,
							healing: true,
							mitigation: true,
						},
						orderBy: [asc(scrimPlayerStatTable.playerName), asc(scrimPlayerStatTable.side)],
					},
				},
				orderBy: [asc(scrimMapTable.mapOrder)],
			},
			ocrJobs: {
				columns: {
					id: true,
					scrimId: true,
					screenshotType: true,
					imageUrl: true,
					status: true,
					progressStage: true,
					errorCode: true,
					errorMessage: true,
					retryCount: true,
					submittedByUserId: true,
					providerName: true,
					providerModel: true,
					promptVersion: true,
					runAfter: true,
					processingTimeMs: true,
					confidenceFlags: true,
					validatedOutput: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					submittedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
				orderBy: [desc(ocrJobTable.createdAt)],
			},
		},
	});
}

type ScrimRow = NonNullable<Awaited<ReturnType<typeof findScrimWithRelations>>>;

type ScrimSummaryRow = {
	id: string;
	status: ScrimRow["status"];
	message: string | null;
	config: ScrimRow["config"];
	scheduledAt: Date | null;
	startedAt: Date | null;
	endedAt: Date | null;
	homeMapScore: number;
	awayMapScore: number;
	createdAt: Date;
	updatedAt: Date;
	createdByUserId: string;
	createdBy: ScrimRow["createdBy"];
	homeTeam: ScrimRow["homeTeam"];
	awayTeam: ScrimRow["awayTeam"];
	confirmations: ScrimRow["confirmations"];
};

function toIsoDate(date: Date | null): string | null {
	return date?.toISOString() ?? null;
}

function mapScrimSummary(scrim: ScrimSummaryRow): ScrimSummary {
	return {
		id: scrim.id,
		status: scrim.status,
		message: scrim.message ?? null,
		config: scrim.config ?? {},
		scheduledAt: toIsoDate(scrim.scheduledAt),
		startedAt: toIsoDate(scrim.startedAt),
		endedAt: toIsoDate(scrim.endedAt),
		homeMapScore: scrim.homeMapScore,
		awayMapScore: scrim.awayMapScore,
		createdAt: scrim.createdAt.toISOString(),
		updatedAt: scrim.updatedAt.toISOString(),
		createdByUserId: scrim.createdByUserId,
		createdByDisplayName: scrim.createdBy?.displayName ?? null,
		homeTeam: {
			id: scrim.homeTeam.id,
			name: scrim.homeTeam.name,
			tag: scrim.homeTeam.tag,
			organizationId: scrim.homeTeam.organizationId,
			organizationName: scrim.homeTeam.organization?.name ?? null,
			avatarUrl: scrim.homeTeam.avatarUrl ?? null,
			rating: scrim.homeTeam.rating,
		},
		awayTeam: scrim.awayTeam
			? {
					id: scrim.awayTeam.id,
					name: scrim.awayTeam.name,
					tag: scrim.awayTeam.tag,
					organizationId: scrim.awayTeam.organizationId,
					organizationName: scrim.awayTeam.organization?.name ?? null,
					avatarUrl: scrim.awayTeam.avatarUrl ?? null,
					rating: scrim.awayTeam.rating,
				}
			: null,
		pendingConfirmationCount: scrim.confirmations.filter(
			(confirmation) => confirmation.status !== "confirmed"
		).length,
	};
}

function mapOcrJob(job: ScrimRow["ocrJobs"][number]): ScrimDetail["ocrJobs"][number] {
	return {
		id: job.id,
		scrimId: job.scrimId,
		screenshotType: job.screenshotType,
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

function publishOcrJobRealtimeUpdate(
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

function resolveMapResult(homeScore: number, awayScore: number) {
	if (homeScore > awayScore) return "victory" as const;
	if (homeScore < awayScore) return "defeat" as const;
	return "draw" as const;
}

function deriveSeriesScore(
	maps: Array<{
		homeScore: number;
		awayScore: number;
	}>
) {
	return maps.reduce(
		(score, map) => {
			if (map.homeScore > map.awayScore) score.homeMapScore += 1;
			else if (map.awayScore > map.homeScore) score.awayMapScore += 1;
			return score;
		},
		{ homeMapScore: 0, awayMapScore: 0 }
	);
}

type ResultSnapshotPlayerInput = {
	playerName: string;
	side: ScrimResultRevisionSnapshot["maps"][number]["players"][number]["side"];
	hero: string | null;
	role: ScrimResultRevisionSnapshot["maps"][number]["players"][number]["role"];
	eliminations: number | null;
	assists: number | null;
	deaths: number | null;
	damage: number | null;
	healing: number | null;
	mitigation: number | null;
};

type ResultSnapshotMapInput = {
	mapOrder?: number;
	mapName: string;
	mapType: ScrimResultRevisionSnapshot["maps"][number]["mapType"] | null;
	scoreboardOcrJobId?: string | null;
	homeScore: number;
	awayScore: number;
	durationSeconds: number | null;
	players: ResultSnapshotPlayerInput[];
};

function buildScrimResultSnapshot(params: {
	homeMapScore: number;
	awayMapScore: number;
	startedAt: string | null;
	endedAt: string | null;
	maps: ResultSnapshotMapInput[];
}): ScrimResultRevisionSnapshot {
	return {
		homeMapScore: params.homeMapScore,
		awayMapScore: params.awayMapScore,
		startedAt: params.startedAt,
		endedAt: params.endedAt,
		maps: params.maps.map((map, index) => ({
			mapOrder: map.mapOrder ?? index + 1,
			mapName: map.mapName,
			mapType: map.mapType ?? "unknown",
			scoreboardOcrJobId: map.scoreboardOcrJobId ?? null,
			homeScore: map.homeScore,
			awayScore: map.awayScore,
			durationSeconds: map.durationSeconds,
			players: map.players.map((player) => ({
				playerName: player.playerName,
				side: player.side,
				hero: player.hero,
				role: player.role,
				eliminations: player.eliminations,
				assists: player.assists,
				deaths: player.deaths,
				damage: player.damage,
				healing: player.healing,
				mitigation: player.mitigation,
			})),
		})),
	};
}

function buildPersistedScrimResultSnapshot(scrim: ScrimRow): ScrimResultRevisionSnapshot {
	return buildScrimResultSnapshot({
		homeMapScore: scrim.homeMapScore,
		awayMapScore: scrim.awayMapScore,
		startedAt: toIsoDate(scrim.startedAt),
		endedAt: toIsoDate(scrim.endedAt),
		maps: scrim.maps.map((map) => ({
			mapOrder: map.mapOrder,
			mapName: map.mapName,
			mapType: map.mapType as ScrimResultRevisionSnapshot["maps"][number]["mapType"],
			scoreboardOcrJobId: null,
			homeScore: map.homeScore,
			awayScore: map.awayScore,
			durationSeconds: map.durationSeconds ?? null,
			players: map.playerStats.map((player) => ({
				playerName: player.playerName,
				side: player.side as ResultSnapshotPlayerInput["side"],
				hero: player.hero ?? null,
				role: player.role ?? null,
				eliminations: player.eliminations ?? null,
				assists: player.assists ?? null,
				deaths: player.deaths ?? null,
				damage: player.damage ?? null,
				healing: player.healing ?? null,
				mitigation: player.mitigation ?? null,
			})),
		})),
	});
}

function parseDurationTextToSeconds(value: string | null) {
	if (!value) return null;

	const [minutesPart, secondsPart] = value.split(":");
	const minutes = Number(minutesPart);
	const seconds = Number(secondsPart);

	if (
		!Number.isInteger(minutes) ||
		!Number.isInteger(seconds) ||
		minutes < 0 ||
		seconds < 0 ||
		seconds >= 60
	) {
		return null;
	}

	return minutes * 60 + seconds;
}

function buildOcrResultSnapshot(
	result: OcrGameHistoryExtractedResult
): ScrimResultRevisionSnapshot {
	const seriesScore = result.matches.reduce(
		(score, match) => {
			if (match.result === "victory") score.homeMapScore += 1;
			else if (match.result === "defeat") score.awayMapScore += 1;
			return score;
		},
		{ homeMapScore: 0, awayMapScore: 0 }
	);

	return buildScrimResultSnapshot({
		homeMapScore: seriesScore.homeMapScore,
		awayMapScore: seriesScore.awayMapScore,
		startedAt: null,
		endedAt: null,
		maps: result.matches.map((match) => ({
			mapOrder: match.matchOrder,
			mapName: match.mapName,
			mapType: match.mapType ?? "unknown",
			scoreboardOcrJobId: null,
			homeScore: match.allyScore,
			awayScore: match.enemyScore,
			durationSeconds: parseDurationTextToSeconds(match.durationText),
			players: [],
		})),
	});
}

function hasPersistedScrimResult(scrim: ScrimRow) {
	return (
		scrim.maps.length > 0 ||
		scrim.homeMapScore > 0 ||
		scrim.awayMapScore > 0 ||
		!!scrim.startedAt ||
		!!scrim.endedAt
	);
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectScrimResultFieldChanges(
	path: string,
	before: JsonValue,
	after: JsonValue,
	fieldChanges: ScrimResultChangeSummary["fieldChanges"]
) {
	if (Array.isArray(before) || Array.isArray(after)) {
		const beforeArray = Array.isArray(before) ? before : [];
		const afterArray = Array.isArray(after) ? after : [];
		const maxLength = Math.max(beforeArray.length, afterArray.length);
		for (let index = 0; index < maxLength; index += 1) {
			collectScrimResultFieldChanges(
				`${path}[${index}]`,
				(beforeArray[index] ?? null) as JsonValue,
				(afterArray[index] ?? null) as JsonValue,
				fieldChanges
			);
		}
		return;
	}

	if (isJsonObject(before) || isJsonObject(after)) {
		const beforeObject = isJsonObject(before) ? before : {};
		const afterObject = isJsonObject(after) ? after : {};
		const keys = [...new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])].sort();

		for (const key of keys) {
			collectScrimResultFieldChanges(
				path ? `${path}.${key}` : key,
				(beforeObject[key] ?? null) as JsonValue,
				(afterObject[key] ?? null) as JsonValue,
				fieldChanges
			);
		}
		return;
	}

	if (before !== after) {
		fieldChanges.push({
			path,
			before,
			after,
		});
	}
}

function createScrimResultChangeSummary(
	basis: ScrimResultDiffBasis,
	beforeSnapshot: ScrimResultRevisionSnapshot,
	afterSnapshot: ScrimResultRevisionSnapshot
): ScrimResultChangeSummary {
	const fieldChanges: ScrimResultChangeSummary["fieldChanges"] = [];
	collectScrimResultFieldChanges(
		"",
		beforeSnapshot as JsonValue,
		afterSnapshot as JsonValue,
		fieldChanges
	);

	return {
		basis,
		changeCount: fieldChanges.length,
		fieldChanges,
	};
}

async function replaceScrimDetailedResult(
	tx: DbTransaction,
	params: {
		scrimId: string;
		homeTeamId: string;
		awayTeamId: string | null;
		sourceOcrJobId: string | null;
		maps: NonNullable<v.InferOutput<typeof SubmitScrimResultSchema>["maps"]>;
	}
) {
	await tx.delete(scrimMapTable).where(eq(scrimMapTable.scrimId, params.scrimId));

	if (params.maps.length === 0) {
		return;
	}

	const insertedMaps = await tx
		.insert(scrimMapTable)
		.values(
			params.maps.map((map, index) => ({
				scrimId: params.scrimId,
				mapOrder: index + 1,
				mapName: map.mapName,
				mapType: map.mapType ?? "unknown",
				durationSeconds: map.durationSeconds ?? null,
				result: resolveMapResult(map.homeScore, map.awayScore),
				homeScore: map.homeScore,
				awayScore: map.awayScore,
				ocrJobId: params.sourceOcrJobId,
			}))
		)
		.returning({
			id: scrimMapTable.id,
			mapOrder: scrimMapTable.mapOrder,
		});

	if (!insertedMaps.length) {
		return;
	}

	const playerRows = insertedMaps.flatMap((insertedMap) => {
		const sourceMap = params.maps[insertedMap.mapOrder - 1];
		return sourceMap.players.map((player) => ({
			scrimMapId: insertedMap.id,
			side: player.side,
			userId: null,
			teamId:
				player.side === "home"
					? params.homeTeamId
					: player.side === "away"
						? params.awayTeamId
						: null,
			playerName: player.playerName,
			hero: player.hero ?? null,
			role: player.role ?? null,
			eliminations: player.eliminations ?? null,
			assists: player.assists ?? null,
			deaths: player.deaths ?? null,
			damage: player.damage ?? null,
			healing: player.healing ?? null,
			mitigation: player.mitigation ?? null,
		}));
	});

	if (playerRows.length > 0) {
		await tx.insert(scrimPlayerStatTable).values(playerRows);
	}
}

function mapScrimMap(map: ScrimRow["maps"][number]): ScrimDetail["maps"][number] {
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

function mapScrimDetail(scrim: ScrimRow): ScrimDetail {
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
			createdAt: event.createdAt.toISOString(),
		})),
		ocrJobs: scrim.ocrJobs.map(mapOcrJob),
		maps: scrim.maps.map(mapScrimMap),
		resultRevisions: scrim.resultRevisions.map(mapScrimResultRevision),
		dispute: {
			resolution: scrim.disputeResolution ?? null,
			resolvedByUserId: scrim.disputeResolvedByUserId ?? null,
			resolvedByDisplayName: scrim.disputeResolvedBy?.displayName ?? null,
			resolvedAt: toIsoDate(scrim.disputeResolvedAt),
			notes: scrim.disputeNotes ?? null,
		},
	};
}

async function canViewTeam(teamId: string, userId: string) {
	const access = await getTeamAccessContext(teamId, userId);
	if (!access) return false;
	if (access.canManageTeam) return true;
	return access.teamStatus
		? TEAM_VIEWABLE_STATUSES.includes(access.teamStatus as (typeof TEAM_VIEWABLE_STATUSES)[number])
		: false;
}

async function canAccessScrim(
	userId: string,
	scrim: { homeTeamId: string; awayTeamId: string | null }
) {
	if (await isUserOnTeam(userId, scrim.homeTeamId)) return true;
	if (scrim.awayTeamId && (await isUserOnTeam(userId, scrim.awayTeamId))) return true;
	return false;
}

function resolveScrimStatus(
	confirmations: { teamId: string; status: ScrimConfirmationStatus }[],
	teamIds: string[]
) {
	const statuses = teamIds.map(
		(teamId) =>
			confirmations.find((confirmation) => confirmation.teamId === teamId)?.status ?? "pending"
	);

	if (statuses.some((status) => status === "disputed")) {
		return "disputed" as const;
	}

	if (statuses.length > 0 && statuses.every((status) => status === "confirmed")) {
		return "completed" as const;
	}

	return "awaiting_confirmation" as const;
}

async function canManageAnyScrimTeam(
	userId: string,
	scrim: { homeTeamId: string; awayTeamId: string | null }
) {
	if (await verifyTeamManager(scrim.homeTeamId, userId)) return true;
	if (scrim.awayTeamId && (await verifyTeamManager(scrim.awayTeamId, userId))) return true;
	return false;
}

async function canResolveScrimDispute(
	userId: string,
	scrim: {
		homeTeam: { organizationId: string };
		awayTeam: { organizationId: string } | null;
	}
) {
	if (await verifyOrgManager(scrim.homeTeam.organizationId, userId)) return true;
	if (scrim.awayTeam?.organizationId) {
		return verifyOrgManager(scrim.awayTeam.organizationId, userId);
	}
	return false;
}

async function notifyTeamAdmins(params: {
	teamId: string;
	actorUserId: string;
	type:
		| "scrim_request"
		| "scrim_accepted"
		| "scrim_cancelled"
		| "scrim_disputed"
		| "scrim_resolved";
	title: string;
	body: string;
	scrimId: string;
}) {
	const adminUserIds = await listTeamAdminUserIds(params.teamId);

	await Promise.all(
		adminUserIds
			.filter((userId) => userId !== params.actorUserId)
			.map((userId) =>
				createNotification({
					userId,
					type: params.type,
					title: params.title,
					body: params.body,
					referenceType: "scrim",
					referenceId: params.scrimId,
				})
			)
	);
}

scrimRoutes.get("/", async (c) => {
	const user = c.get("user");
	const requestedTeamId = c.req.query("teamId");

	let teamIds: string[] = [];

	if (requestedTeamId) {
		const allowed = await canViewTeam(requestedTeamId, user.id);
		if (!allowed) {
			return c.json({ error: "You do not have access to this team's scrims." }, 403);
		}
		teamIds = [requestedTeamId];
	} else {
		const memberships = await db.query.teamRosterTable.findMany({
			where: and(
				eq(teamRosterTable.userId, user.id),
				inArray(teamRosterTable.status, TEAM_VIEWABLE_STATUSES)
			),
			columns: { teamId: true },
		});
		teamIds = [...new Set(memberships.map((membership) => membership.teamId))];
	}

	if (teamIds.length === 0) {
		return c.json({ data: [] });
	}

	const rows = await db.query.scrimTable.findMany({
		where: or(inArray(scrimTable.homeTeamId, teamIds), inArray(scrimTable.awayTeamId, teamIds)),
		with: {
			homeTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			awayTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			createdBy: {
				columns: { id: true, displayName: true },
			},
			confirmations: {
				columns: {
					id: true,
					teamId: true,
					status: true,
					disputeReason: true,
					confirmedByUserId: true,
					confirmedAt: true,
					updatedAt: true,
				},
				with: {
					team: {
						columns: { id: true, name: true, tag: true },
					},
					confirmedBy: {
						columns: { id: true, displayName: true },
					},
				},
			},
			ocrJobs: {
				columns: {
					id: true,
					scrimId: true,
					screenshotType: true,
					imageUrl: true,
					status: true,
					progressStage: true,
					errorCode: true,
					errorMessage: true,
					retryCount: true,
					submittedByUserId: true,
					providerName: true,
					providerModel: true,
					promptVersion: true,
					runAfter: true,
					processingTimeMs: true,
					confidenceFlags: true,
					validatedOutput: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					submittedBy: {
						columns: { id: true, displayName: true },
					},
				},
				orderBy: [desc(ocrJobTable.createdAt)],
			},
		},
		orderBy: [desc(scrimTable.scheduledAt), desc(scrimTable.createdAt)],
		limit: 100,
	});

	return c.json({ data: rows.map(mapScrimSummary) });
});

scrimRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const scrim = await findScrimWithRelations(c.req.param("id"));
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!(await canAccessScrim(user.id, scrim))) {
		return c.json({ error: "You do not have access to this scrim." }, 403);
	}

	return c.json({ data: mapScrimDetail(scrim) });
});

scrimRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateScrimSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	if (parsed.output.awayTeamId && parsed.output.awayTeamId === parsed.output.homeTeamId) {
		return c.json({ error: "Home and away teams must be different." }, 400);
	}

	if (!(await verifyTeamManager(parsed.output.homeTeamId, user.id))) {
		return c.json({ error: "You do not have permission to create scrims for this team." }, 403);
	}

	if (parsed.output.awayTeamId) {
		const awayTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, parsed.output.awayTeamId),
			columns: { id: true },
		});
		if (!awayTeam) return c.json({ error: "Away team not found." }, 404);
	}

	const scrim = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(scrimTable)
			.values({
				homeTeamId: parsed.output.homeTeamId,
				awayTeamId: parsed.output.awayTeamId ?? null,
				status: "pending",
				message: parsed.output.message ?? null,
				scheduledAt: parsed.output.scheduledAt ? new Date(parsed.output.scheduledAt) : null,
				config: parsed.output.config ?? {},
				createdByUserId: user.id,
			})
			.returning({ id: scrimTable.id });

		const confirmationTeamIds = [
			parsed.output.homeTeamId,
			...(parsed.output.awayTeamId ? [parsed.output.awayTeamId] : []),
		];

		if (confirmationTeamIds.length > 0) {
			await tx.insert(scrimConfirmationTable).values(
				confirmationTeamIds.map((teamId) => ({
					scrimId: inserted.id,
					teamId,
					status: "pending" as const,
				}))
			);
		}

		return inserted;
	});

	const detail = await findScrimWithRelations(scrim.id);
	if (!detail) return c.json({ error: "Scrim not found after creation." }, 500);

	await ensureScrimConversationLifecycle(scrim.id);
	if (detail.awayTeam) {
		await notifyTeamAdmins({
			teamId: detail.awayTeam.id,
			actorUserId: user.id,
			type: "scrim_request",
			title: "New scrim request",
			body: `${detail.homeTeam.name} sent a scrim request for ${toIsoDate(detail.scheduledAt) ?? "an unscheduled slot"}.`,
			scrimId: detail.id,
		});
	}

	return c.json({ data: mapScrimDetail(detail) }, 201);
});

scrimRoutes.post("/:id/confirm", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ConfirmScrimSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	if (parsed.output.status === "disputed" && !parsed.output.disputeReason) {
		return c.json({ error: "A dispute reason is required when disputing a result." }, 400);
	}

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (![scrim.homeTeamId, scrim.awayTeamId].includes(parsed.output.teamId)) {
		return c.json({ error: "This team is not part of the scrim." }, 400);
	}
	if (!(await verifyTeamManager(parsed.output.teamId, user.id))) {
		return c.json({ error: "You do not have permission to confirm results for this team." }, 403);
	}

	try {
		await db.transaction(async (tx) => {
			await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

			const lockedScrim = await tx.query.scrimTable.findFirst({
				where: eq(scrimTable.id, scrimId),
				columns: {
					id: true,
					homeTeamId: true,
					awayTeamId: true,
					status: true,
				},
				with: {
					confirmations: {
						columns: {
							teamId: true,
							status: true,
						},
					},
				},
			});

			if (!lockedScrim) {
				throw new ScrimWorkflowError(404, "Scrim not found.");
			}
			if (![lockedScrim.homeTeamId, lockedScrim.awayTeamId].includes(parsed.output.teamId)) {
				throw new ScrimWorkflowError(400, "This team is not part of the scrim.");
			}
			if (lockedScrim.status === "cancelled") {
				throw new ScrimWorkflowError(400, "Cancelled scrims cannot be confirmed.");
			}
			if (lockedScrim.status === "completed") {
				throw new ScrimWorkflowError(
					400,
					"Completed scrims are locked once ratings have been applied."
				);
			}
			if (lockedScrim.status !== "awaiting_confirmation" && lockedScrim.status !== "disputed") {
				throw new ScrimWorkflowError(
					400,
					"Scrim confirmations are only available after a result has been reported."
				);
			}
			if (!lockedScrim.awayTeamId) {
				throw new ScrimWorkflowError(400, "Scrim confirmations require both teams.");
			}

			await tx
				.insert(scrimConfirmationTable)
				.values({
					scrimId,
					teamId: parsed.output.teamId,
					status: parsed.output.status,
					disputeReason:
						parsed.output.status === "disputed" ? (parsed.output.disputeReason ?? null) : null,
					confirmedByUserId: user.id,
					confirmedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [scrimConfirmationTable.scrimId, scrimConfirmationTable.teamId],
					set: {
						status: parsed.output.status,
						disputeReason:
							parsed.output.status === "disputed" ? (parsed.output.disputeReason ?? null) : null,
						confirmedByUserId: user.id,
						confirmedAt: new Date(),
						updatedAt: new Date(),
					},
				});

			const confirmations = await tx.query.scrimConfirmationTable.findMany({
				where: eq(scrimConfirmationTable.scrimId, scrimId),
				columns: {
					teamId: true,
					status: true,
				},
			});

			const nextStatus = resolveScrimStatus(confirmations, [
				lockedScrim.homeTeamId,
				lockedScrim.awayTeamId,
			]);

			if (nextStatus === "completed") {
				await tx
					.update(scrimTable)
					.set({
						disputeResolution: null,
						disputeResolvedByUserId: null,
						disputeResolvedAt: null,
						disputeNotes: null,
					})
					.where(eq(scrimTable.id, scrimId));

				await applyCompletedScrimRating(tx, scrimId);
				return;
			}

			await tx
				.update(scrimTable)
				.set({
					status: nextStatus,
					disputeResolution: nextStatus === "disputed" ? "pending" : null,
					disputeResolvedByUserId: null,
					disputeResolvedAt: null,
					disputeNotes: null,
				})
				.where(eq(scrimTable.id, scrimId));
		});
	} catch (error) {
		if (error instanceof ScrimWorkflowError) {
			return c.json({ error: error.message }, { status: error.status as 400 | 404 });
		}

		throw error;
	}

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after status update." }, 500);

	if (parsed.output.status === "disputed") {
		await Promise.all(
			[detail.homeTeam.id, detail.awayTeam?.id ?? null]
				.filter((teamId): teamId is string => !!teamId)
				.map((teamId) =>
					notifyTeamAdmins({
						teamId,
						actorUserId: user.id,
						type: "scrim_disputed",
						title: "Scrim result disputed",
						body: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was disputed and now needs org-level resolution.`,
						scrimId: detail.id,
					})
				)
		);
	}

	return c.json({ data: mapScrimDetail(detail) });
});

scrimRoutes.post("/:id/respond", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToScrimSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (scrim.status === "completed") {
		return c.json({ error: "Completed scrims cannot be changed." }, 400);
	}

	if (parsed.output.action === "accept") {
		if (!scrim.awayTeamId) {
			return c.json({ error: "This scrim request does not have an opponent yet." }, 400);
		}
		if (!(await verifyTeamManager(scrim.awayTeamId, user.id))) {
			return c.json({ error: "Only the away team can accept this scrim request." }, 403);
		}
		if (scrim.status !== "pending") {
			return c.json({ error: "Only pending scrim requests can be accepted." }, 400);
		}

		await db
			.update(scrimTable)
			.set({
				status: parsed.output.scheduledAt || scrim.scheduledAt ? "scheduled" : "accepted",
				scheduledAt: parsed.output.scheduledAt
					? new Date(parsed.output.scheduledAt)
					: scrim.scheduledAt,
			})
			.where(eq(scrimTable.id, scrimId));
	} else {
		if (!(await canManageAnyScrimTeam(user.id, scrim))) {
			return c.json({ error: "Only a team manager can cancel this scrim." }, 403);
		}
		if (scrim.status === "awaiting_confirmation" || scrim.status === "disputed") {
			return c.json(
				{
					error:
						"Once results have been reported, this scrim must be settled through confirmations or dispute resolution.",
				},
				400
			);
		}
		if (scrim.status === "cancelled") {
			return c.json({ error: "This scrim is already cancelled." }, 400);
		}

		await db
			.update(scrimTable)
			.set({
				status: "cancelled",
			})
			.where(eq(scrimTable.id, scrimId));
	}

	await ensureScrimConversationLifecycle(scrimId);

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after update." }, 500);

	if (parsed.output.action === "accept") {
		await notifyTeamAdmins({
			teamId: detail.homeTeam.id,
			actorUserId: user.id,
			type: "scrim_accepted",
			title: "Scrim request accepted",
			body: `${detail.awayTeam?.name ?? "The opponent"} accepted your scrim request.`,
			scrimId: detail.id,
		});
	} else {
		await Promise.all(
			[detail.homeTeam.id, detail.awayTeam?.id ?? null]
				.filter((teamId): teamId is string => !!teamId)
				.map((teamId) =>
					notifyTeamAdmins({
						teamId,
						actorUserId: user.id,
						type: "scrim_cancelled",
						title: "Scrim cancelled",
						body: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} has been cancelled.`,
						scrimId: detail.id,
					})
				)
		);
	}

	return c.json({ data: mapScrimDetail(detail) });
});

scrimRoutes.post("/:id/result", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(SubmitScrimResultSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	if (
		parsed.output.startedAt &&
		parsed.output.endedAt &&
		new Date(parsed.output.endedAt) < new Date(parsed.output.startedAt)
	) {
		return c.json({ error: "End time cannot be earlier than start time." }, 400);
	}
	if (parsed.output.maps && parsed.output.maps.length > 9) {
		return c.json({ error: "A scrim cannot contain more than 9 maps." }, 400);
	}

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!scrim.awayTeamId) {
		return c.json({ error: "Scrim results require both teams to be assigned." }, 400);
	}
	if (
		parsed.output.reportingTeamId !== scrim.homeTeamId &&
		parsed.output.reportingTeamId !== scrim.awayTeamId
	) {
		return c.json({ error: "The reporting team must participate in this scrim." }, 400);
	}
	if (!(await verifyTeamManager(parsed.output.reportingTeamId, user.id))) {
		return c.json({ error: "Only a manager for the reporting team can submit this result." }, 403);
	}
	if (scrim.status === "cancelled" || scrim.status === "completed") {
		return c.json({ error: "This scrim can no longer accept result reports." }, 400);
	}
	if (scrim.status === "pending") {
		return c.json(
			{ error: "Pending scrim requests must be accepted before reporting results." },
			400
		);
	}
	const sourceJob = parsed.output.sourceOcrJobId
		? scrim.ocrJobs.find((job) => job.id === parsed.output.sourceOcrJobId)
		: null;
	const sourceJobValidatedOutput =
		(sourceJob?.validatedOutput as ScrimDetail["ocrJobs"][number]["validatedOutput"]) ?? null;
	if (parsed.output.sourceOcrJobId) {
		if (!sourceJob || !sourceJobValidatedOutput) {
			return c.json(
				{ error: "The selected OCR draft is not available for this scrim anymore." },
				400
			);
		}
		if (sourceJobValidatedOutput.screenshotType !== "game_history") {
			return c.json(
				{
					error:
						"Only game history OCR drafts can prefill reviewed scrim results. Scoreboard OCR stays available as evidence only.",
				},
				400
			);
		}
	}
	const scoreboardSourceJobIds = [
		...new Set(
			(parsed.output.maps ?? []).flatMap((map) =>
				map.scoreboardOcrJobId ? [map.scoreboardOcrJobId] : []
			)
		),
	];
	const scoreboardSourceJobs = scoreboardSourceJobIds.map((jobId) =>
		scrim.ocrJobs.find((job) => job.id === jobId)
	);
	for (const [index, scoreboardSourceJob] of scoreboardSourceJobs.entries()) {
		const scoreboardJobId = scoreboardSourceJobIds[index];
		const scoreboardValidatedOutput =
			(scoreboardSourceJob?.validatedOutput as ScrimDetail["ocrJobs"][number]["validatedOutput"]) ??
			null;

		if (!scoreboardSourceJob || !scoreboardValidatedOutput) {
			return c.json(
				{
					error: `The selected scoreboard OCR draft ${scoreboardJobId} is no longer available for this scrim.`,
				},
				400
			);
		}
		if (scoreboardValidatedOutput.screenshotType !== "scoreboard") {
			return c.json(
				{
					error: "Only scoreboard OCR drafts can be attached as map-level player-stat evidence.",
				},
				400
			);
		}
	}

	let resolvedHomeMapScore = parsed.output.homeMapScore;
	let resolvedAwayMapScore = parsed.output.awayMapScore;

	if (parsed.output.maps && parsed.output.maps.length > 0) {
		const derivedSeriesScore = deriveSeriesScore(parsed.output.maps);
		if (
			parsed.output.homeMapScore !== derivedSeriesScore.homeMapScore ||
			parsed.output.awayMapScore !== derivedSeriesScore.awayMapScore
		) {
			return c.json(
				{
					error:
						"Series score must match the reviewed map results. Adjust the map rows or the final score before submitting.",
				},
				400
			);
		}

		resolvedHomeMapScore = derivedSeriesScore.homeMapScore;
		resolvedAwayMapScore = derivedSeriesScore.awayMapScore;
	}

	const resultStartedAtDate = parsed.output.startedAt
		? new Date(parsed.output.startedAt)
		: scrim.startedAt;
	const resultEndedAtDate = parsed.output.endedAt ? new Date(parsed.output.endedAt) : scrim.endedAt;
	const reviewedSnapshot = buildScrimResultSnapshot({
		homeMapScore: resolvedHomeMapScore,
		awayMapScore: resolvedAwayMapScore,
		startedAt: resultStartedAtDate?.toISOString() ?? null,
		endedAt: resultEndedAtDate?.toISOString() ?? null,
		maps: (parsed.output.maps ?? []).map((map, index) => ({
			mapOrder: index + 1,
			mapName: map.mapName,
			mapType: map.mapType ?? "unknown",
			scoreboardOcrJobId: map.scoreboardOcrJobId ?? null,
			homeScore: map.homeScore,
			awayScore: map.awayScore,
			durationSeconds: map.durationSeconds ?? null,
			players: map.players.map((player) => ({
				playerName: player.playerName,
				side: player.side,
				hero: player.hero ?? null,
				role: player.role ?? null,
				eliminations: player.eliminations ?? null,
				assists: player.assists ?? null,
				deaths: player.deaths ?? null,
				damage: player.damage ?? null,
				healing: player.healing ?? null,
				mitigation: player.mitigation ?? null,
			})),
		})),
	});

	await db.transaction(async (tx) => {
		await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

		const latestRevision = await tx.query.scrimResultRevisionTable.findFirst({
			where: eq(scrimResultRevisionTable.scrimId, scrimId),
			columns: {
				revisionNumber: true,
				snapshot: true,
			},
			orderBy: [desc(scrimResultRevisionTable.revisionNumber)],
		});

		const diffBasis: ScrimResultDiffBasis =
			sourceJobValidatedOutput?.screenshotType === "game_history"
				? "ocr_job"
				: latestRevision
					? "previous_revision"
					: hasPersistedScrimResult(scrim)
						? "existing_result"
						: "manual_baseline";
		const comparisonSnapshot =
			sourceJobValidatedOutput?.screenshotType === "game_history"
				? buildOcrResultSnapshot(sourceJobValidatedOutput as OcrGameHistoryExtractedResult)
				: latestRevision
					? (latestRevision.snapshot as ScrimResultRevisionSnapshot)
					: hasPersistedScrimResult(scrim)
						? buildPersistedScrimResultSnapshot(scrim)
						: buildScrimResultSnapshot({
								homeMapScore: 0,
								awayMapScore: 0,
								startedAt: null,
								endedAt: null,
								maps: [],
							});
		const changeSummary = createScrimResultChangeSummary(
			diffBasis,
			comparisonSnapshot,
			reviewedSnapshot
		);

		await tx
			.update(scrimTable)
			.set({
				homeMapScore: resolvedHomeMapScore,
				awayMapScore: resolvedAwayMapScore,
				startedAt: resultStartedAtDate,
				endedAt: resultEndedAtDate,
				status: "awaiting_confirmation",
				disputeResolution: null,
				disputeResolvedByUserId: null,
				disputeResolvedAt: null,
				disputeNotes: null,
			})
			.where(eq(scrimTable.id, scrimId));

		await replaceScrimDetailedResult(tx, {
			scrimId,
			homeTeamId: scrim.homeTeamId,
			awayTeamId: scrim.awayTeamId,
			sourceOcrJobId: parsed.output.sourceOcrJobId ?? null,
			maps: parsed.output.maps ?? [],
		});

		await tx
			.update(scrimConfirmationTable)
			.set({
				status: "pending",
				disputeReason: null,
				confirmedByUserId: null,
				confirmedAt: null,
				updatedAt: new Date(),
			})
			.where(eq(scrimConfirmationTable.scrimId, scrimId));

		await tx.insert(scrimResultRevisionTable).values({
			scrimId,
			revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
			reportingTeamId: parsed.output.reportingTeamId,
			submittedByUserId: user.id,
			sourceOcrJobId: parsed.output.sourceOcrJobId ?? null,
			homeMapScore: reviewedSnapshot.homeMapScore,
			awayMapScore: reviewedSnapshot.awayMapScore,
			startedAt: resultStartedAtDate,
			endedAt: resultEndedAtDate,
			snapshot: reviewedSnapshot,
			changeSummary,
		});
	});

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after result submission." }, 500);

	return c.json({ data: mapScrimDetail(detail) });
});

scrimRoutes.post("/:id/resolve-dispute", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ResolveScrimDisputeSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!(await canResolveScrimDispute(user.id, scrim))) {
		return c.json(
			{ error: "Only organization managers for the participating teams can resolve disputes." },
			403
		);
	}

	try {
		await db.transaction(async (tx) => {
			const now = new Date();

			await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

			const lockedScrim = await tx.query.scrimTable.findFirst({
				where: eq(scrimTable.id, scrimId),
				columns: {
					id: true,
					status: true,
					awayTeamId: true,
				},
			});

			if (!lockedScrim) {
				throw new ScrimWorkflowError(404, "Scrim not found.");
			}
			if (lockedScrim.status !== "disputed") {
				throw new ScrimWorkflowError(400, "Only disputed scrims can be resolved here.");
			}
			if (!lockedScrim.awayTeamId) {
				throw new ScrimWorkflowError(400, "Dispute resolution requires both teams.");
			}

			if (parsed.output.action === "confirm_reported_result") {
				await tx
					.update(scrimTable)
					.set({
						disputeResolution: "admin_resolved",
						disputeResolvedByUserId: user.id,
						disputeResolvedAt: now,
						disputeNotes: parsed.output.notes ?? null,
					})
					.where(eq(scrimTable.id, scrimId));

				await applyCompletedScrimRating(tx, scrimId);
				return;
			}

			await tx
				.update(scrimTable)
				.set({
					status: "cancelled",
					disputeResolution: "voided",
					disputeResolvedByUserId: user.id,
					disputeResolvedAt: now,
					disputeNotes: parsed.output.notes ?? null,
				})
				.where(eq(scrimTable.id, scrimId));
		});
	} catch (error) {
		if (error instanceof ScrimWorkflowError) {
			return c.json({ error: error.message }, { status: error.status as 400 | 404 });
		}

		throw error;
	}

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after dispute resolution." }, 500);

	await Promise.all(
		[detail.homeTeam.id, detail.awayTeam?.id ?? null]
			.filter((teamId): teamId is string => !!teamId)
			.map((teamId) =>
				notifyTeamAdmins({
					teamId,
					actorUserId: user.id,
					type: "scrim_resolved",
					title: "Scrim dispute resolved",
					body:
						parsed.output.action === "confirm_reported_result"
							? `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was finalized from the disputed report.`
							: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was voided after dispute review.`,
					scrimId: detail.id,
				})
			)
	);

	return c.json({ data: mapScrimDetail(detail) });
});

scrimRoutes.get("/:id/ocr-jobs", async (c) => {
	const user = c.get("user");
	const scrim = await findScrimWithRelations(c.req.param("id"));
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!(await canAccessScrim(user.id, scrim))) {
		return c.json({ error: "You do not have access to this scrim." }, 403);
	}

	return c.json({
		data: mapScrimDetail(scrim).ocrJobs,
	});
});

scrimRoutes.post("/:id/ocr-jobs", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateScrimOcrJobSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!(await canAccessScrim(user.id, scrim))) {
		return c.json({ error: "You do not have access to this scrim." }, 403);
	}

	const [job] = await db
		.insert(ocrJobTable)
		.values({
			scrimId,
			submittedByUserId: user.id,
			screenshotType: parsed.output.screenshotType,
			imageUrl: parsed.output.imageUrl,
			status: "queued",
			progressStage: "queued",
			runAfter: new Date(),
			confidenceFlags: [],
		})
		.returning({ id: ocrJobTable.id });

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after OCR job creation." }, 500);

	const createdJob = mapScrimDetail(detail).ocrJobs.find((ocrJob) => ocrJob.id === job.id) ?? null;
	if (createdJob) {
		publishOcrJobRealtimeUpdate(createdJob);
	}

	return c.json(
		{
			data: createdJob,
		},
		201
	);
});

scrimRoutes.post("/:id/ocr-jobs/:jobId/retry", async (c) => {
	const user = c.get("user");
	const scrimId = c.req.param("id");
	const jobId = c.req.param("jobId");

	const scrim = await findScrimWithRelations(scrimId);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!(await canManageAnyScrimTeam(user.id, scrim))) {
		return c.json({ error: "Only a team manager can retry OCR jobs for this scrim." }, 403);
	}

	const existingJob = scrim.ocrJobs.find((job) => job.id === jobId);
	if (!existingJob) {
		return c.json({ error: "OCR job not found." }, 404);
	}

	await db
		.update(ocrJobTable)
		.set({
			status: "queued",
			progressStage: "queued",
			errorCode: null,
			errorMessage: null,
			runAfter: new Date(),
			leaseExpiresAt: null,
			startedAt: null,
			completedAt: null,
			processingTimeMs: null,
			rawOcrOutput: null,
			validatedOutput: null,
			confidenceFlags: [],
		})
		.where(eq(ocrJobTable.id, jobId));

	const detail = await findScrimWithRelations(scrimId);
	if (!detail) return c.json({ error: "Scrim not found after OCR retry." }, 500);

	const retriedJob = detail.ocrJobs.find((ocrJob) => ocrJob.id === jobId);
	if (retriedJob) {
		publishOcrJobRealtimeUpdate(mapOcrJob(retriedJob));
	}

	return c.json({
		data: retriedJob ? mapOcrJob(retriedJob) : null,
	});
});

publicScrimRoutes.use("*", optionalAuth);

publicScrimRoutes.get("/", async (c) => {
	const rows = await db.query.scrimTable.findMany({
		where: and(inArray(scrimTable.status, PUBLIC_SCRIM_STATUSES), isNotNull(scrimTable.awayTeamId)),
		with: {
			homeTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			awayTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			createdBy: {
				columns: { id: true, displayName: true },
			},
			confirmations: {
				columns: {
					id: true,
					teamId: true,
					status: true,
					disputeReason: true,
					confirmedByUserId: true,
					confirmedAt: true,
					updatedAt: true,
				},
				with: {
					team: {
						columns: { id: true, name: true, tag: true },
					},
					confirmedBy: {
						columns: { id: true, displayName: true },
					},
				},
			},
			ocrJobs: {
				columns: {
					id: true,
					scrimId: true,
					screenshotType: true,
					imageUrl: true,
					status: true,
					progressStage: true,
					errorCode: true,
					errorMessage: true,
					retryCount: true,
					submittedByUserId: true,
					providerName: true,
					providerModel: true,
					promptVersion: true,
					runAfter: true,
					processingTimeMs: true,
					confidenceFlags: true,
					validatedOutput: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					submittedBy: {
						columns: { id: true, displayName: true },
					},
				},
				orderBy: [desc(ocrJobTable.createdAt)],
			},
		},
		orderBy: [desc(scrimTable.scheduledAt), desc(scrimTable.createdAt)],
		limit: 50,
	});

	return c.json({
		data: rows.map(mapScrimSummary),
	});
});

export { publicScrimRoutes, scrimRoutes };
