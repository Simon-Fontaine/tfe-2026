import * as v from "valibot";

const REPORT_STATUS_VALUES = ["pending", "under_review", "resolved", "dismissed"] as const;
const REPORT_CATEGORY_VALUES = [
	"harassment",
	"spam",
	"impersonation",
	"abuse",
	"evidence_manipulation",
	"dispute_abuse",
	"suspicious_recruiting",
	"other",
] as const;
const REPORT_TARGET_TYPE_VALUES = [
	"user",
	"team",
	"organization",
	"listing",
	"message",
	"scrim",
	"update",
	"ocr_evidence",
] as const;

export const ModerationCasePatchSchema = v.variant("action", [
	v.object({ action: v.literal("assign") }),
	v.object({ action: v.literal("unassign") }),
	v.object({
		action: v.literal("note"),
		content: v.pipe(v.string(), v.trim(), v.minLength(5), v.maxLength(2000)),
	}),
	v.object({
		action: v.literal("resolve"),
		reason: v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(2000)),
	}),
	v.object({
		action: v.literal("dismiss"),
		reason: v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(2000)),
	}),
]);

export type ModerationCasePatchInput = v.InferOutput<typeof ModerationCasePatchSchema>;

export const ModerationQueueFilterSchema = v.object({
	status: v.optional(v.picklist(REPORT_STATUS_VALUES)),
	category: v.optional(v.picklist(REPORT_CATEGORY_VALUES)),
	targetType: v.optional(v.picklist(REPORT_TARGET_TYPE_VALUES)),
	assignedTo: v.optional(v.picklist(["me", "unassigned"] as const)),
	cursor: v.optional(v.string()),
});

export type ModerationQueueFilterInput = v.InferOutput<typeof ModerationQueueFilterSchema>;

const MODERATION_ACTION_TYPE_VALUES = [
	"warn",
	"suspend",
	"restore",
	"hide",
	"unhide",
	"remove",
	"require_verification",
	"clear_verification",
	"escalate",
] as const;

export const CreateModerationActionSchema = v.object({
	caseId: v.optional(v.pipe(v.string(), v.uuid())),
	targetType: v.picklist(REPORT_TARGET_TYPE_VALUES),
	targetId: v.pipe(v.string(), v.uuid()),
	actionType: v.picklist(MODERATION_ACTION_TYPE_VALUES),
	reason: v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(2000)),
	scope: v.optional(v.record(v.string(), v.unknown())),
	durationHours: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

export type CreateModerationActionInput = v.InferOutput<typeof CreateModerationActionSchema>;
