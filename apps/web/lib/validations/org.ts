import * as v from "valibot";

const OW2_ROLE_VALUES = ["tank", "damage", "support"] as const;
const ROSTER_STATUS_VALUES = ["active", "benched", "trial", "inactive"] as const;
const ORG_ROLE_VALUES = ["owner", "manager", "coach", "analyst", "player"] as const;
const INVITE_ACTION_VALUES = ["accept", "decline"] as const;

// ─── Organisation ─────────────────────────────────────────────────────────────

export const CreateOrgSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Organisation name must be at least 2 characters"),
		v.maxLength(50, "Organisation name cannot exceed 50 characters")
	),
	description: v.optional(
		v.pipe(v.string(), v.maxLength(280, "Description cannot exceed 280 characters"))
	),
});

export type CreateOrgInput = v.InferOutput<typeof CreateOrgSchema>;

export const UpdateOrgSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Organisation name must be at least 2 characters"),
		v.maxLength(50, "Organisation name cannot exceed 50 characters")
	),
	description: v.optional(
		v.pipe(v.string(), v.maxLength(280, "Description cannot exceed 280 characters"))
	),
});

export type UpdateOrgInput = v.InferOutput<typeof UpdateOrgSchema>;

// ─── Team ─────────────────────────────────────────────────────────────────────

export const CreateTeamSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Team name must be at least 2 characters"),
		v.maxLength(50, "Team name cannot exceed 50 characters")
	),
	tag: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Tag must be 2–5 characters"),
		v.maxLength(5, "Tag must be 2–5 characters"),
		v.regex(/^[A-Za-z0-9]+$/, "Tag must contain only letters and numbers")
	),
	description: v.optional(
		v.pipe(v.string(), v.maxLength(280, "Description cannot exceed 280 characters"))
	),
});

export type CreateTeamInput = v.InferOutput<typeof CreateTeamSchema>;

// ─── Roster ───────────────────────────────────────────────────────────────────

export const AddPlayerSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	userId: v.pipe(v.string(), v.uuid("Invalid user ID")),
	roleInTeam: v.picklist(OW2_ROLE_VALUES, "Please select a role"),
	status: v.picklist(ROSTER_STATUS_VALUES, "Please select a status"),
});

export type AddPlayerInput = v.InferOutput<typeof AddPlayerSchema>;

export const UpdateRosterStatusSchema = v.object({
	rosterId: v.pipe(v.string(), v.uuid("Invalid roster ID")),
	status: v.picklist(ROSTER_STATUS_VALUES, "Please select a status"),
});

export type UpdateRosterStatusInput = v.InferOutput<typeof UpdateRosterStatusSchema>;

export const RemoveRosterMemberSchema = v.object({
	rosterId: v.pipe(v.string(), v.uuid("Invalid roster ID")),
});

export type RemoveRosterMemberInput = v.InferOutput<typeof RemoveRosterMemberSchema>;

// ─── Team management ──────────────────────────────────────────────────────────

export const UpdateTeamSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Team name must be at least 2 characters"),
		v.maxLength(50, "Team name cannot exceed 50 characters")
	),
	tag: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Tag must be 2–5 characters"),
		v.maxLength(5, "Tag must be 2–5 characters"),
		v.regex(/^[A-Za-z0-9]+$/, "Tag must contain only letters and numbers")
	),
	description: v.optional(
		v.pipe(v.string(), v.maxLength(280, "Description cannot exceed 280 characters"))
	),
});

export type UpdateTeamInput = v.InferOutput<typeof UpdateTeamSchema>;

export const ToggleRecruitingSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type ToggleRecruitingInput = v.InferOutput<typeof ToggleRecruitingSchema>;

export const ArchiveTeamSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type ArchiveTeamInput = v.InferOutput<typeof ArchiveTeamSchema>;

export const DeleteTeamSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type DeleteTeamInput = v.InferOutput<typeof DeleteTeamSchema>;

// ─── Organisation management ──────────────────────────────────────────────────

export const DeleteOrgSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	confirmName: v.pipe(v.string(), v.minLength(1, "Please type the organisation name to confirm")),
});

export type DeleteOrgInput = v.InferOutput<typeof DeleteOrgSchema>;

export const UpdateOrgMemberRoleSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
	role: v.picklist(ORG_ROLE_VALUES, "Please select a role"),
});

export type UpdateOrgMemberRoleInput = v.InferOutput<typeof UpdateOrgMemberRoleSchema>;

export const RemoveOrgMemberSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
});

export type RemoveOrgMemberInput = v.InferOutput<typeof RemoveOrgMemberSchema>;

// ─── Team invites ─────────────────────────────────────────────────────────────

export const InviteToTeamSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	userId: v.pipe(v.string(), v.uuid("Invalid user ID")),
	roleInTeam: v.picklist(OW2_ROLE_VALUES, "Please select a role"),
});

export type InviteToTeamInput = v.InferOutput<typeof InviteToTeamSchema>;

export const RespondToTeamInviteSchema = v.object({
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
	action: v.picklist(INVITE_ACTION_VALUES, "Please select an action"),
});

export type RespondToTeamInviteInput = v.InferOutput<typeof RespondToTeamInviteSchema>;

export const CancelTeamInviteSchema = v.object({
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
});

export type CancelTeamInviteInput = v.InferOutput<typeof CancelTeamInviteSchema>;

// ─── Org invites ──────────────────────────────────────────────────────────────

export const InviteToOrgSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	userId: v.pipe(v.string(), v.uuid("Invalid user ID")),
	role: v.picklist(["manager", "coach", "analyst", "player"] as const, "Please select a role"),
});

export type InviteToOrgInput = v.InferOutput<typeof InviteToOrgSchema>;

export const RespondToOrgInviteSchema = v.object({
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
	action: v.picklist(INVITE_ACTION_VALUES, "Please select an action"),
});

export type RespondToOrgInviteInput = v.InferOutput<typeof RespondToOrgInviteSchema>;
