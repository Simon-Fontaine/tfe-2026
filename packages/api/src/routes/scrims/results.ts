import type {
	JsonValue,
	OcrGameHistoryExtractedResult,
	ScrimResultChangeSummary,
	ScrimResultDiffBasis,
	ScrimResultRevisionSnapshot,
	SubmitScrimResultSchema,
} from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import type * as v from "valibot";
import { scrimMapTable, scrimPlayerStatTable } from "@/db/schema";
import type { DbTransaction, ScrimRow } from "./shared";
import { toIsoDate } from "./shared";

function resolveMapResult(homeScore: number, awayScore: number) {
	if (homeScore > awayScore) return "victory" as const;
	if (homeScore < awayScore) return "defeat" as const;
	return "draw" as const;
}

export function deriveSeriesScore(
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

export function buildScrimResultSnapshot(params: {
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

export function buildPersistedScrimResultSnapshot(scrim: ScrimRow): ScrimResultRevisionSnapshot {
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

export function buildOcrResultSnapshot(
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

export function hasPersistedScrimResult(scrim: ScrimRow) {
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

export function createScrimResultChangeSummary(
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

export async function replaceScrimDetailedResult(
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
