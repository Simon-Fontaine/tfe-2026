import * as v from "valibot";
import {
	OCR_MAP_TYPE_VALUES,
	OCR_MAX_MAP_SCORE,
	OCR_PLAYER_SIDE_VALUES,
	OCR_ROLE_VALUES,
	OCR_SCREENSHOT_TYPE_VALUES,
} from "./ocr";

const SCRIM_CONFIRMATION_STATUS_VALUES = ["confirmed", "disputed"] as const;
const SCRIM_RESPONSE_ACTION_VALUES = [
	"accept",
	"cancel",
	"decline",
	"reschedule",
	"propose_changes",
	"start",
] as const;
const SCRIM_DISPUTE_RESOLUTION_ACTION_VALUES = ["confirm_reported_result", "void_scrim"] as const;

const optionalUuid = v.optional(v.pipe(v.string(), v.uuid("Invalid ID")));
const optionalIsoDate = v.optional(v.pipe(v.string(), v.isoTimestamp("Invalid timestamp")));
const optionalTrimmedString = (maxLength: number, message: string) =>
	v.optional(v.pipe(v.string(), v.trim(), v.maxLength(maxLength, message)));
const nullableShortString = v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(120)));
const nullableInteger = v.nullable(
	v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999))
);

const scheduledAtCreatePipe = v.optional(
	v.pipe(
		v.string(),
		v.isoTimestamp("Invalid timestamp"),
		v.check((val) => new Date(val).getTime() >= Date.now(), "scheduledAt cannot be in the past")
	)
);

export const CreateScrimSchema = v.object({
	homeTeamId: v.pipe(v.string(), v.uuid("Invalid home team ID")),
	awayTeamId: optionalUuid,
	scheduledAt: scheduledAtCreatePipe,
	message: optionalTrimmedString(1000, "Message cannot exceed 1000 characters"),
	config: v.optional(
		v.object({
			bestOf: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9))),
			format: optionalTrimmedString(60, "Format cannot exceed 60 characters"),
			mapPool: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(80)))),
			heroRestrictions: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(80)))),
		})
	),
});

export type CreateScrimInput = v.InferOutput<typeof CreateScrimSchema>;

export const RespondToScrimSchema = v.object({
	action: v.picklist(SCRIM_RESPONSE_ACTION_VALUES, "Invalid scrim action"),
	scheduledAt: optionalIsoDate,
	config: v.optional(
		v.object({
			bestOf: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9))),
			format: optionalTrimmedString(60, "Format cannot exceed 60 characters"),
			mapPool: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(80)))),
			heroRestrictions: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(80)))),
		})
	),
	message: optionalTrimmedString(1000, "Message cannot exceed 1000 characters"),
	cancelReason: optionalTrimmedString(500, "Cancel reason cannot exceed 500 characters"),
});

export type RespondToScrimInput = v.InferOutput<typeof RespondToScrimSchema>;

// Series only — player stats are saved per-map via ApplyScrimMapPlayerStatsSchema.
export const SubmitScrimResultSchema = v.object({
	reportingTeamId: v.pipe(v.string(), v.uuid("Invalid reporting team ID")),
	homeMapScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9)),
	awayMapScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9)),
	startedAt: optionalIsoDate,
	endedAt: optionalIsoDate,
	sourceOcrJobId: optionalUuid,
	maps: v.optional(
		v.array(
			v.object({
				mapName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
				mapType: v.nullable(v.picklist(OCR_MAP_TYPE_VALUES, "Invalid map type")),
				homeScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(OCR_MAX_MAP_SCORE)),
				awayScore: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(OCR_MAX_MAP_SCORE)),
				durationSeconds: v.nullable(
					v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7200))
				),
			})
		)
	),
});

export type SubmitScrimResultInput = v.InferOutput<typeof SubmitScrimResultSchema>;

const ScrimPlayerStatRowSchema = v.object({
	userId: optionalUuid,
	playerName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
	side: v.picklist(OCR_PLAYER_SIDE_VALUES, "Invalid player side"),
	hero: nullableShortString,
	role: v.nullable(v.picklist(OCR_ROLE_VALUES, "Invalid Overwatch role")),
	eliminations: nullableInteger,
	assists: nullableInteger,
	deaths: nullableInteger,
	damage: nullableInteger,
	healing: nullableInteger,
	mitigation: nullableInteger,
});

// Replaces the player-stat rows for one map. `scoreboardOcrJobId` is the backing
// scan (null for manual entry).
export const ApplyScrimMapPlayerStatsSchema = v.object({
	reportingTeamId: v.pipe(v.string(), v.uuid("Invalid reporting team ID")),
	scoreboardOcrJobId: optionalUuid,
	players: v.array(ScrimPlayerStatRowSchema),
});

export type ApplyScrimMapPlayerStatsInput = v.InferOutput<typeof ApplyScrimMapPlayerStatsSchema>;

export const ConfirmScrimSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	status: v.picklist(SCRIM_CONFIRMATION_STATUS_VALUES, "Invalid confirmation status"),
	disputeReason: optionalTrimmedString(1000, "Dispute reason cannot exceed 1000 characters"),
});

export type ConfirmScrimInput = v.InferOutput<typeof ConfirmScrimSchema>;

export const ResolveScrimDisputeSchema = v.object({
	action: v.picklist(SCRIM_DISPUTE_RESOLUTION_ACTION_VALUES, "Invalid dispute resolution action"),
	notes: optionalTrimmedString(1000, "Resolution notes cannot exceed 1000 characters"),
});

export type ResolveScrimDisputeInput = v.InferOutput<typeof ResolveScrimDisputeSchema>;

export const RespondToScrimDisputeSchema = v.object({
	reportingTeamId: v.pipe(v.string(), v.uuid()),
	responseText: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
});

export type RespondToScrimDisputeInput = v.InferOutput<typeof RespondToScrimDisputeSchema>;

export const CreateScrimOcrJobSchema = v.object({
	screenshotType: v.picklist(OCR_SCREENSHOT_TYPE_VALUES, "Invalid screenshot type"),
	imageUrl: v.pipe(v.string(), v.trim(), v.url("Invalid image URL")),
	scrimMapId: v.optional(v.pipe(v.string(), v.uuid("Invalid scrim map ID"))),
});

export type CreateScrimOcrJobInput = v.InferOutput<typeof CreateScrimOcrJobSchema>;
