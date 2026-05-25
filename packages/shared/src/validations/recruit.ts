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
const LISTING_CATEGORY_VALUES = ["lft", "lfp", "lfr", "lfs"] as const;
const OWNER_TYPE_VALUES = ["player", "team", "organization"] as const;
const MEMBER_TYPE_VALUES = ["player", "staff"] as const;
const STAFF_ROLE_VALUES = ["coach", "analyst", "manager", "staff"] as const;
const LISTING_STATUS_TRANSITION_VALUES = ["open", "paused", "closed", "fulfilled"] as const;
const APPLICATION_DECISION_VALUES = ["accept", "reject"] as const;

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

export const CreateRecruitmentListingSchema = v.object({
	category: v.picklist(LISTING_CATEGORY_VALUES, "Please select a category"),
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
	minRating: v.optional(v.number("Minimum rating must be a number")),
	maxRating: v.optional(v.number("Maximum rating must be a number")),
	region: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60, "Region name too long"))),
	expiresAt: v.optional(v.string()),
});

export type CreateRecruitmentListingInput = v.InferOutput<typeof CreateRecruitmentListingSchema>;

export const UpdateRecruitmentListingSchema = v.object({
	listingId: v.pipe(v.string(), v.uuid("Invalid listing ID")),
	category: v.picklist(LISTING_CATEGORY_VALUES, "Please select a category"),
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
	minRating: v.optional(v.number("Minimum rating must be a number")),
	maxRating: v.optional(v.number("Maximum rating must be a number")),
	region: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60, "Region name too long"))),
	expiresAt: v.optional(v.string()),
});

export type UpdateRecruitmentListingInput = v.InferOutput<typeof UpdateRecruitmentListingSchema>;

export const UpdateRecruitmentListingStatusSchema = v.object({
	listingId: v.pipe(v.string(), v.uuid("Invalid listing ID")),
	status: v.picklist(LISTING_STATUS_TRANSITION_VALUES, "Invalid listing status"),
});

export type UpdateRecruitmentListingStatusInput = v.InferOutput<
	typeof UpdateRecruitmentListingStatusSchema
>;

export const CreateRecruitmentApplicationSchema = v.object({
	listingId: v.pipe(v.string(), v.uuid("Invalid listing ID")),
	message: optionalMessage,
	senderTeamId: optionalUuid,
	senderOrganizationId: optionalUuid,
});

export type CreateRecruitmentApplicationInput = v.InferOutput<
	typeof CreateRecruitmentApplicationSchema
>;

export const WithdrawRecruitmentApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
});

export type WithdrawRecruitmentApplicationInput = v.InferOutput<
	typeof WithdrawRecruitmentApplicationSchema
>;

export const UpdateRecruitmentApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
	message: optionalMessage,
});

export type UpdateRecruitmentApplicationInput = v.InferOutput<
	typeof UpdateRecruitmentApplicationSchema
>;

export const DecideRecruitmentApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
	action: v.picklist(APPLICATION_DECISION_VALUES, "Please select an action"),
	memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
	staffRole: optionalStaffRole,
	gameRole: optionalOw2Role,
});

export type DecideRecruitmentApplicationInput = v.InferOutput<
	typeof DecideRecruitmentApplicationSchema
>;
