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

const DOMAIN_AUDIT_DOMAIN_VALUES = [
	"ownership",
	"permissions",
	"moderation",
	"result",
	"evidence",
	"data_lifecycle",
	"admin",
	"governance",
] as const;

const DOMAIN_AUDIT_ACTION_TYPE_VALUES = [
	"ownership_transfer_initiated",
	"ownership_transfer_accepted",
	"ownership_transfer_declined",
	"ownership_recovery_initiated",
	"ownership_recovery_resolved",
	"permission_role_changed",
	"permission_member_removed",
	"moderation_action_taken",
	"moderation_action_reversed",
	"result_correction_applied",
	"dispute_initiated",
	"dispute_responded",
	"dispute_resolved",
	"dispute_voided",
	"evidence_uploaded",
	"evidence_removed",
	"account_deletion_requested",
	"account_deletion_confirmed",
	"account_deletion_cancelled",
	"data_export_requested",
	"lifecycle_archived",
	"lifecycle_restored",
	"lifecycle_deletion_pending",
	"governance_recovery_applied",
	"governance_containment_applied",
] as const;

export const DomainAuditQuerySchema = v.object({
	actorId: v.optional(v.pipe(v.string(), v.uuid())),
	domain: v.optional(v.picklist(DOMAIN_AUDIT_DOMAIN_VALUES)),
	actionType: v.optional(v.picklist(DOMAIN_AUDIT_ACTION_TYPE_VALUES)),
	targetType: v.optional(v.string()),
	targetId: v.optional(v.pipe(v.string(), v.uuid())),
	outcome: v.optional(v.string()),
	from: v.optional(v.pipe(v.string(), v.isoTimestamp())),
	to: v.optional(v.pipe(v.string(), v.isoTimestamp())),
	cursor: v.optional(v.string()),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))),
});

export type DomainAuditQueryInput = v.InferOutput<typeof DomainAuditQuerySchema>;

export const ModeratorOwnershipResolutionSchema = v.object({
	action: v.picklist(["approve", "reject"] as const),
	reason: v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(2000)),
});
export type ModeratorOwnershipResolutionInput = v.InferOutput<
	typeof ModeratorOwnershipResolutionSchema
>;
