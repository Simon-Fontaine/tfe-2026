import * as v from "valibot";

const OW2_RANK_VALUES = [
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"master",
	"grandmaster",
	"champion",
] as const;

const OW2_ROLE_VALUES = ["tank", "damage", "support"] as const;
const POST_CATEGORY_VALUES = ["lft", "lfp", "lfr", "lfs"] as const;
const OWNER_TYPE_VALUES = ["player", "team", "organization"] as const;
const MEMBER_TYPE_VALUES = ["player", "staff"] as const;
const STAFF_ROLE_VALUES = ["coach", "analyst", "manager", "staff"] as const;
const POST_STATUS_VALUES = ["open", "closed", "fulfilled", "expired"] as const;
const RESPONSE_DECISION_VALUES = ["accept", "reject"] as const;

const optionalDescription = v.optional(
	v.pipe(v.string(), v.trim(), v.maxLength(800, "Description cannot exceed 800 characters"))
);

const optionalMessage = v.optional(
	v.pipe(v.string(), v.trim(), v.maxLength(1000, "Message cannot exceed 1000 characters"))
);

const optionalUuid = v.optional(v.pipe(v.string(), v.uuid("Invalid ID")));
const optionalOw2Role = v.optional(v.picklist(OW2_ROLE_VALUES, "Invalid role"));
const optionalStaffRole = v.optional(v.picklist(STAFF_ROLE_VALUES, "Invalid staff role"));
const optionalGameRoles = v.optional(v.array(v.picklist(OW2_ROLE_VALUES, "Invalid role")));
const optionalRank = v.optional(v.picklist(OW2_RANK_VALUES, "Invalid rank"));

export const CreateRecruitmentPostSchema = v.object({
	category: v.picklist(POST_CATEGORY_VALUES, "Please select a category"),
	ownerType: v.picklist(OWNER_TYPE_VALUES, "Please select an owner"),
	organizationId: optionalUuid,
	teamId: optionalUuid,
	title: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, "Title must be at least 3 characters"),
		v.maxLength(120, "Title cannot exceed 120 characters")
	),
	description: optionalDescription,
	memberType: v.picklist(MEMBER_TYPE_VALUES, "Please select a member type"),
	staffRole: optionalStaffRole,
	gameRoles: optionalGameRoles,
	minRank: optionalRank,
	maxRank: optionalRank,
	minSr: v.optional(v.number("Minimum SR must be a number")),
	maxSr: v.optional(v.number("Maximum SR must be a number")),
	region: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60, "Region name too long"))),
	expiresAt: v.optional(v.string()),
});

export type CreateRecruitmentPostInput = v.InferOutput<typeof CreateRecruitmentPostSchema>;

export const UpdateRecruitmentPostSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
	category: v.picklist(POST_CATEGORY_VALUES, "Please select a category"),
	title: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, "Title must be at least 3 characters"),
		v.maxLength(120, "Title cannot exceed 120 characters")
	),
	description: optionalDescription,
	memberType: v.picklist(MEMBER_TYPE_VALUES, "Please select a member type"),
	staffRole: optionalStaffRole,
	gameRoles: optionalGameRoles,
	minRank: optionalRank,
	maxRank: optionalRank,
	minSr: v.optional(v.number("Minimum SR must be a number")),
	maxSr: v.optional(v.number("Maximum SR must be a number")),
	region: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60, "Region name too long"))),
	expiresAt: v.optional(v.string()),
	status: v.optional(v.picklist(POST_STATUS_VALUES, "Invalid post status")),
});

export type UpdateRecruitmentPostInput = v.InferOutput<typeof UpdateRecruitmentPostSchema>;

export const UpdateRecruitmentPostStatusSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
	status: v.picklist(POST_STATUS_VALUES, "Invalid post status"),
});

export type UpdateRecruitmentPostStatusInput = v.InferOutput<
	typeof UpdateRecruitmentPostStatusSchema
>;

export const CreateRecruitmentResponseSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
	message: optionalMessage,
	senderTeamId: optionalUuid,
	senderOrganizationId: optionalUuid,
});

export type CreateRecruitmentResponseInput = v.InferOutput<typeof CreateRecruitmentResponseSchema>;

export const WithdrawRecruitmentResponseSchema = v.object({
	responseId: v.pipe(v.string(), v.uuid("Invalid response ID")),
});

export type WithdrawRecruitmentResponseInput = v.InferOutput<
	typeof WithdrawRecruitmentResponseSchema
>;

export const DecideRecruitmentResponseSchema = v.object({
	responseId: v.pipe(v.string(), v.uuid("Invalid response ID")),
	action: v.picklist(RESPONSE_DECISION_VALUES, "Please select an action"),
	memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
	staffRole: optionalStaffRole,
	gameRole: optionalOw2Role,
});

export type DecideRecruitmentResponseInput = v.InferOutput<typeof DecideRecruitmentResponseSchema>;

export const SendRecruitmentMessageSchema = v.object({
	threadId: v.pipe(v.string(), v.uuid("Invalid thread ID")),
	content: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "Message cannot be empty"),
		v.maxLength(2000, "Message cannot exceed 2000 characters")
	),
});

export type SendRecruitmentMessageInput = v.InferOutput<typeof SendRecruitmentMessageSchema>;
