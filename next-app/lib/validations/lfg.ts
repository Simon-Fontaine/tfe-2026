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

const APPLICATION_ACTION_VALUES = ["accept", "reject"] as const;

// ─── LFG Posts ────────────────────────────────────────────────────────────────

export const CreateLfgPostSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	rolesNeeded: v.array(v.picklist(OW2_ROLE_VALUES, "Invalid role")),
	minRank: v.optional(v.picklist(OW2_RANK_VALUES, "Invalid rank")),
	maxRank: v.optional(v.picklist(OW2_RANK_VALUES, "Invalid rank")),
	description: v.optional(
		v.pipe(v.string(), v.maxLength(500, "Description cannot exceed 500 characters"))
	),
	region: v.optional(v.pipe(v.string(), v.maxLength(50, "Region name too long"))),
});

export type CreateLfgPostInput = v.InferOutput<typeof CreateLfgPostSchema>;

export const CloseLfgPostSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
});

export type CloseLfgPostInput = v.InferOutput<typeof CloseLfgPostSchema>;

// ─── Applications ─────────────────────────────────────────────────────────────

export const ApplyToLfgPostSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
	message: v.optional(v.pipe(v.string(), v.maxLength(500, "Message cannot exceed 500 characters"))),
});

export type ApplyToLfgPostInput = v.InferOutput<typeof ApplyToLfgPostSchema>;

export const RespondToApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	action: v.picklist(APPLICATION_ACTION_VALUES, "Please select an action"),
	roleInTeam: v.optional(v.picklist(OW2_ROLE_VALUES, "Invalid role")),
});

export type RespondToApplicationInput = v.InferOutput<typeof RespondToApplicationSchema>;

export const WithdrawApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
});

export type WithdrawApplicationInput = v.InferOutput<typeof WithdrawApplicationSchema>;
