import * as v from "valibot";

const OW2_ROLE_VALUES = ["tank", "damage", "support"] as const;
const ROSTER_STATUS_VALUES = ["active", "benched", "trial", "inactive"] as const;
const ORG_ROLE_VALUES = ["owner", "admin", "member"] as const;
const TEAM_PERMISSION_ROLE_VALUES = ["admin", "member"] as const;
const MEMBER_TYPE_VALUES = ["player", "staff"] as const;
const STAFF_ROLE_VALUES = ["coach", "analyst", "manager", "staff"] as const;
const INVITE_ACTION_VALUES = ["accept", "decline"] as const;

const optionalDescription = v.optional(
	v.pipe(v.string(), v.trim(), v.maxLength(800, "Description cannot exceed 800 characters"))
);

const optionalSlug = v.optional(
	v.pipe(
		v.string(),
		v.trim(),
		v.maxLength(50, "Slug cannot exceed 50 characters"),
		v.check(
			(value) => value.length === 0 || value.length >= 2,
			"Slug must be at least 2 characters"
		),
		v.check(
			(value) => value.length === 0 || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
			"Slug must use lowercase letters, numbers, and hyphens"
		)
	)
);

const optionalPublicUrl = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(500, "URL is too long"),
	v.check((value) => {
		if (value.length === 0) return true;
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}, "Enter a full http:// or https:// URL")
);
const optionalUrl = v.optional(optionalPublicUrl);
const optionalSocial = v.optional(v.pipe(optionalPublicUrl, v.maxLength(100, "Value is too long")));
const optionalBoolean = v.optional(v.boolean());

const optionalGameRole = v.optional(v.picklist(OW2_ROLE_VALUES, "Please select a role"));
const optionalStaffRole = v.optional(v.picklist(STAFF_ROLE_VALUES, "Please select a staff role"));
const optionalPermissionRole = v.optional(
	v.picklist(TEAM_PERMISSION_ROLE_VALUES, "Please select a team permission role")
);

// ─── Organisation ─────────────────────────────────────────────────────────────

export const CreateOrgSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Organisation name must be at least 2 characters"),
		v.maxLength(50, "Organisation name cannot exceed 50 characters")
	),
	slug: optionalSlug,
	description: optionalDescription,
	avatarUrl: optionalUrl,
	bannerUrl: optionalUrl,
	website: optionalUrl,
	discord: optionalSocial,
	twitter: optionalSocial,
	isPublic: optionalBoolean,
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
	slug: optionalSlug,
	description: optionalDescription,
	avatarUrl: optionalUrl,
	bannerUrl: optionalUrl,
	website: optionalUrl,
	discord: optionalSocial,
	twitter: optionalSocial,
	isPublic: optionalBoolean,
});

export type UpdateOrgInput = v.InferOutput<typeof UpdateOrgSchema>;

export const TransferOrgOwnershipSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
});

export type TransferOrgOwnershipInput = v.InferOutput<typeof TransferOrgOwnershipSchema>;

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

export const UpdateOrgMemberSchema = v.pipe(
	v.object({
		orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
		memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
		role: v.optional(v.picklist(ORG_ROLE_VALUES, "Please select a role")),
		memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
		staffRole: optionalStaffRole,
		gameRole: optionalGameRole,
	}),
	v.check(
		(input) =>
			input.role !== undefined ||
			input.memberType !== undefined ||
			input.staffRole !== undefined ||
			input.gameRole !== undefined,
		"Provide at least one organisation member field to update"
	)
);

export type UpdateOrgMemberInput = v.InferOutput<typeof UpdateOrgMemberSchema>;

export const RemoveOrgMemberSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
});

export type RemoveOrgMemberInput = v.InferOutput<typeof RemoveOrgMemberSchema>;

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
	description: optionalDescription,
	avatarUrl: optionalUrl,
	bannerUrl: optionalUrl,
	isPublic: optionalBoolean,
});

export type CreateTeamInput = v.InferOutput<typeof CreateTeamSchema>;

export const UpdateTeamSchema = v.object({
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
	description: optionalDescription,
	avatarUrl: optionalUrl,
	bannerUrl: optionalUrl,
	isPublic: optionalBoolean,
});

export type UpdateTeamInput = v.InferOutput<typeof UpdateTeamSchema>;

export const TeamScopedSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type TeamScopedInput = v.InferOutput<typeof TeamScopedSchema>;

export const TeamMemberScopedSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
});

export type TeamMemberScopedInput = v.InferOutput<typeof TeamMemberScopedSchema>;

export const UpdateTeamMemberSchema = v.pipe(
	v.object({
		teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
		memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
		memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
		roleInTeam: optionalGameRole,
		gameRole: optionalGameRole,
		staffRole: optionalStaffRole,
		status: v.optional(v.picklist(ROSTER_STATUS_VALUES, "Please select a status")),
		permissionRole: optionalPermissionRole,
	}),
	v.check(
		(input) =>
			input.memberType !== undefined ||
			input.roleInTeam !== undefined ||
			input.gameRole !== undefined ||
			input.staffRole !== undefined ||
			input.status !== undefined ||
			input.permissionRole !== undefined,
		"Provide at least one team member field to update"
	)
);

export type UpdateTeamMemberInput = v.InferOutput<typeof UpdateTeamMemberSchema>;

export const RemoveRosterMemberSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
});

export type RemoveRosterMemberInput = v.InferOutput<typeof RemoveRosterMemberSchema>;

export const UpdateTeamMemberPermissionSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	memberId: v.pipe(v.string(), v.uuid("Invalid member ID")),
	permissionRole: v.picklist(TEAM_PERMISSION_ROLE_VALUES, "Please select a permission role"),
});

export type UpdateTeamMemberPermissionInput = v.InferOutput<
	typeof UpdateTeamMemberPermissionSchema
>;

// ─── Team management ──────────────────────────────────────────────────────────

export const ToggleRecruitingSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type ToggleRecruitingInput = v.InferOutput<typeof ToggleRecruitingSchema>;

export const ArchiveTeamSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type ArchiveTeamInput = v.InferOutput<typeof ArchiveTeamSchema>;

export const DeleteTeamSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
});

export type DeleteTeamInput = v.InferOutput<typeof DeleteTeamSchema>;

// ─── Team invites ─────────────────────────────────────────────────────────────

export const InviteToTeamSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	userId: v.pipe(v.string(), v.uuid("Invalid user ID")),
	memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
	roleInTeam: optionalGameRole,
	gameRole: optionalGameRole,
	staffRole: optionalStaffRole,
	permissionRole: optionalPermissionRole,
});

export type InviteToTeamInput = v.InferOutput<typeof InviteToTeamSchema>;

export const RespondToTeamInviteSchema = v.object({
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
	action: v.picklist(INVITE_ACTION_VALUES, "Please select an action"),
});

export type RespondToTeamInviteInput = v.InferOutput<typeof RespondToTeamInviteSchema>;

export const CancelTeamInviteSchema = v.object({
	teamId: v.pipe(v.string(), v.uuid("Invalid team ID")),
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
});

export type CancelTeamInviteInput = v.InferOutput<typeof CancelTeamInviteSchema>;

// ─── Org invites ──────────────────────────────────────────────────────────────

export const InviteToOrgSchema = v.object({
	orgId: v.pipe(v.string(), v.uuid("Invalid organisation ID")),
	userId: v.pipe(v.string(), v.uuid("Invalid user ID")),
	role: v.picklist(["admin", "member"] as const, "Please select a role"),
	memberType: v.optional(v.picklist(MEMBER_TYPE_VALUES, "Please select a member type")),
	staffRole: optionalStaffRole,
	gameRole: optionalGameRole,
});

export type InviteToOrgInput = v.InferOutput<typeof InviteToOrgSchema>;

export const RespondToOrgInviteSchema = v.object({
	inviteId: v.pipe(v.string(), v.uuid("Invalid invite ID")),
	action: v.picklist(INVITE_ACTION_VALUES, "Please select an action"),
});

export type RespondToOrgInviteInput = v.InferOutput<typeof RespondToOrgInviteSchema>;
