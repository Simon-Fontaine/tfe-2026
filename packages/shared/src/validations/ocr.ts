import * as v from "valibot";

export const OCR_SCREENSHOT_TYPE_VALUES = ["game_history", "scoreboard"] as const;
export const OCR_PROGRESS_STAGE_VALUES = [
	"queued",
	"claimed",
	"preprocessing",
	"provider_request",
	"validating",
	"requires_review",
	"completed",
	"failed",
] as const;
export const OCR_CONFIDENCE_FLAG_VALUES = [
	"incomplete_map_results",
	"incomplete_player_stats",
	"manual_review_required",
] as const;
export const OCR_MATCH_RESULT_VALUES = ["victory", "defeat", "draw"] as const;
export const OCR_MAP_TYPE_VALUES = [
	"assault",
	"clash",
	"control",
	"escort",
	"flashpoint",
	"hybrid",
	"push",
	"unknown",
] as const;
export const OCR_PLAYER_SIDE_VALUES = ["home", "away", "unknown"] as const;
export const OCR_ROLE_VALUES = ["tank", "damage", "support"] as const;
export const OCR_GAME_MODE_VALUES = [
	"competitive_role_queue",
	"competitive_open_queue",
	"custom_game",
	"conquest_meta_event",
	"deathmatch",
	"payload_race",
	"stadium_competitive",
	"unranked_role_queue",
	"unranked_open_queue",
] as const;
export const OCR_HERO_NAME_VALUES = [
	"Ana",
	"Anran",
	"Ashe",
	"Baptiste",
	"Bastion",
	"Brigitte",
	"Cassidy",
	"D.Va",
	"Domina",
	"Doomfist",
	"Echo",
	"Emre",
	"Freja",
	"Genji",
	"Hanzo",
	"Hazard",
	"Illari",
	"Jetpack Cat",
	"Junker Queen",
	"Junkrat",
	"Juno",
	"Kiriko",
	"Lifeweaver",
	"Lúcio",
	"Mauga",
	"Mei",
	"Mercy",
	"Mizuki",
	"Moira",
	"Orisa",
	"Pharah",
	"Ramattra",
	"Reaper",
	"Reinhardt",
	"Roadhog",
	"Sigma",
	"Sojourn",
	"Soldier: 76",
	"Sombra",
	"Symmetra",
	"Torbjörn",
	"Tracer",
	"Vendetta",
	"Venture",
	"Widowmaker",
	"Winston",
	"Wrecking Ball",
	"Wuyang",
	"Zarya",
	"Zenyatta",
] as const;

const optionalWarnings = v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240)));
const nullableDurationText = v.nullable(
	v.pipe(v.string(), v.trim(), v.regex(/^[0-9]{1,2}:[0-9]{2}$/, "Invalid duration format"))
);

export const OcrGameHistoryMatchSchema = v.object({
	matchOrder: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
	mapName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
	mapType: v.nullable(v.picklist(OCR_MAP_TYPE_VALUES, "Invalid map type")),
	gameMode: v.nullable(v.picklist(OCR_GAME_MODE_VALUES, "Invalid game mode")),
	durationText: nullableDurationText,
	result: v.picklist(OCR_MATCH_RESULT_VALUES, "Invalid match result"),
	allyScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9)),
	enemyScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9)),
});

export const OcrScoreboardPlayerSchema = v.object({
	playerName: v.pipe(v.string(), v.trim(), v.maxLength(120)),
	hero: v.nullable(v.picklist(OCR_HERO_NAME_VALUES, "Invalid hero name")),
	role: v.nullable(v.picklist(OCR_ROLE_VALUES, "Invalid Overwatch role")),
	eliminations: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
	assists: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
	deaths: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
	damage: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
	healing: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
	mitigation: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
});

export const OcrGameHistoryExtractedResultSchema = v.object({
	screenshotType: v.literal("game_history"),
	matches: v.array(OcrGameHistoryMatchSchema),
	warnings: optionalWarnings,
});

export const OcrScoreboardExtractedResultSchema = v.object({
	screenshotType: v.literal("scoreboard"),
	allyTeam: v.array(OcrScoreboardPlayerSchema),
	enemyTeam: v.array(OcrScoreboardPlayerSchema),
	warnings: optionalWarnings,
});

export const OcrExtractedResultSchema = v.variant("screenshotType", [
	OcrGameHistoryExtractedResultSchema,
	OcrScoreboardExtractedResultSchema,
]);

export type OcrGameHistoryMatchInput = v.InferOutput<typeof OcrGameHistoryMatchSchema>;
export type OcrScoreboardPlayerInput = v.InferOutput<typeof OcrScoreboardPlayerSchema>;
export type OcrGameHistoryExtractedResultInput = v.InferOutput<
	typeof OcrGameHistoryExtractedResultSchema
>;
export type OcrScoreboardExtractedResultInput = v.InferOutput<
	typeof OcrScoreboardExtractedResultSchema
>;
export type OcrExtractedResultInput = v.InferOutput<typeof OcrExtractedResultSchema>;
