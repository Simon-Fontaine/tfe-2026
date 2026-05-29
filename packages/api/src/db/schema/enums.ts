import { pgEnum } from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS

/** Overwatch 2 in-game roles. */
export const ow2RoleEnum = pgEnum("ow2_role", ["tank", "damage", "support"]);

/** Competitive rank tiers. */
export const ow2RankEnum = pgEnum("ow2_rank", [
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"master",
	"grandmaster",
	"champion",
]);

/** Core map game-mode types. */
export const mapTypeEnum = pgEnum("map_type", [
	"assault",
	"clash",
	"control",
	"escort",
	"flashpoint",
	"hybrid",
	"push",
	"unknown",
]);

/** Lobby and queue types the OCR can extract. */
export const gameModeEnum = pgEnum("game_mode", [
	"competitive_role_queue",
	"competitive_open_queue",
	"custom_game",
	"conquest_meta_event",
	"deathmatch",
	"payload_race",
	"stadium_competitive",
	"unranked_role_queue",
	"unranked_open_queue",
]);

/** Outcome of a single map or overall scrim from the home-team perspective. */
export const matchResultEnum = pgEnum("match_result", ["victory", "defeat", "draw"]);

/** Lifecycle states of a scrim request. */
export const scrimStatusEnum = pgEnum("scrim_status", [
	"pending",
	"accepted",
	"scheduled",
	"in_progress",
	"awaiting_confirmation",
	"completed",
	"cancelled",
	"disputed",
]);

/** Per-team confirmation state after a scrim ends. */
export const confirmationStatusEnum = pgEnum("confirmation_status", [
	"pending",
	"confirmed",
	"disputed",
]);

/** Dispute resolution outcomes. */
export const disputeResolutionEnum = pgEnum("dispute_resolution", [
	"pending",
	"home_confirmed",
	"away_confirmed",
	"admin_resolved",
	"voided",
]);

/** Unified recruitment post categories. */
export const recruitmentListingCategoryEnum = pgEnum("recruitment_listing_category", [
	"lft",
	"lfp",
	"lfr",
	"lfs",
]);

export const recruitmentListingStatusEnum = pgEnum("recruitment_listing_status", [
	"open",
	"paused",
	"closed",
	"fulfilled",
	"expired",
]);

/** Access roles within an organization. */
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

/** Functional membership type. */
export const memberTypeEnum = pgEnum("member_type", ["player", "staff"]);

/** Functional staff specialties. */
export const staffRoleEnum = pgEnum("staff_role", ["coach", "analyst", "manager", "staff"]);

/** Roster slot status — tracks whether a player is actively competing. */
export const rosterStatusEnum = pgEnum("roster_status", ["active", "benched", "trial", "inactive"]);

/** Team-local permission level layered on top of gameplay role/status. */
export const teamMemberRoleEnum = pgEnum("team_member_role", ["admin", "member"]);

/** Recruit post ownership. */
export const recruitmentOwnerTypeEnum = pgEnum("recruitment_owner_type", [
	"player",
	"team",
	"organization",
]);

/** OCR async job lifecycle. */
export const ocrJobStatusEnum = pgEnum("ocr_job_status", [
	"queued",
	"processing",
	"completed",
	"failed",
	"requires_review",
	"superseded",
]);

/** Update feed owner scope. */
export const updateScopeEnum = pgEnum("update_scope", ["team", "organization"]);

/** Whether an update stays inside the workspace or appears publicly. */
export const updateVisibilityEnum = pgEnum("update_visibility", ["workspace", "public"]);

/** Chat channel context — determines access rules and lifecycle. */
export const channelTypeEnum = pgEnum("channel_type", [
	"scrim_lobby", // Created when a scrim is accepted. Members: both teams' rosters.
	"scrim_negotiation", // Created when a scrim request is sent (pre-accept). Members: both managers.
	"team", // Persistent team-internal chat. Members: active roster + coaches.
	"recruitment", // Created per recruitment application. Members: applicant + team managers.
	"direct", // 1-on-1 direct message between two users.
]);

/** Sensitive account actions requiring email or code verification. */
export const verificationActionEnum = pgEnum("verification_action", [
	"email_change",
	"account_deletion",
	"password_change",
	"two_factor_disable",
	"passkey_disable",
	"security_key_disable",
	"recovery_code_regenerate",
	"organization_lifecycle_delete",
	"team_lifecycle_delete",
]);

/** Why a session was revoked — enables security dashboards and alerts. */
export const sessionRevocationReasonEnum = pgEnum("session_revocation_reason", [
	"manual_logout",
	"logout_all_devices",
	"password_change",
	"email_change",
	"two_factor_change",
	"admin_revoke",
	"security_alert",
	"account_deletion",
]);

/** Recruitment application lifecycle. */
export const recruitmentApplicationStatusEnum = pgEnum("recruitment_application_status", [
	"pending",
	"accepted",
	"rejected",
	"withdrawn",
]);

/** Team invite lifecycle. */
export const teamInviteStatusEnum = pgEnum("team_invite_status", [
	"pending",
	"accepted",
	"declined",
	"expired",
	"cancelled",
]);

/** Org invite lifecycle. */
export const orgInviteStatusEnum = pgEnum("org_invite_status", [
	"pending",
	"accepted",
	"declined",
	"expired",
	"cancelled",
]);

/** Security audit log event types — immutable append-only log. */
export const auditActionEnum = pgEnum("audit_action", [
	"login_success",
	"login_failed",
	"logout",
	"logout_all_devices",
	"signup",
	"password_change",
	"password_reset_request",
	"password_reset_complete",
	"email_change_request",
	"email_change_complete",
	"two_factor_enable",
	"two_factor_disable",
	"passkey_register",
	"passkey_remove",
	"security_key_register",
	"security_key_remove",
	"recovery_codes_regenerate",
	"data_export_request",
	"account_deletion_request",
	"account_deletion_confirm",
	"account_deletion_cancel",
	"session_revoked",
	"new_device_detected",
	"new_location_detected",
]);

/** Player stat side in a scrim map — which team perspective the OCR extracted. */
export const playerStatSideEnum = pgEnum("player_stat_side", ["home", "away", "unknown"]);

/** User report categories. */
export const reportCategoryEnum = pgEnum("report_category", [
	"harassment",
	"spam",
	"impersonation",
	"abuse",
	"evidence_manipulation",
	"dispute_abuse",
	"suspicious_recruiting",
	"other",
]);

/** Target entity type for a user report. */
export const reportTargetTypeEnum = pgEnum("report_target_type", [
	"user",
	"team",
	"organization",
	"listing",
	"message",
	"scrim",
	"update",
	"ocr_evidence",
]);

/** User report lifecycle status. */
export const reportStatusEnum = pgEnum("report_status", [
	"pending",
	"under_review",
	"resolved",
	"dismissed",
]);

/** Actions a moderator can take on a case — append-only event log. */
export const moderationCaseActionEnum = pgEnum("moderation_case_action", [
	"viewed",
	"assigned",
	"unassigned",
	"noted",
	"resolved",
	"dismissed",
]);

/** Enforcement action types a moderator can apply to a target entity. */
export const moderationActionTypeEnum = pgEnum("moderation_action_type", [
	"warn",
	"suspend",
	"restore",
	"hide",
	"unhide",
	"remove",
	"require_verification",
	"clear_verification",
	"escalate",
]);

/** Notification delivery channel. */
export const notificationTypeEnum = pgEnum("notification_type", [
	"scrim_request",
	"scrim_accepted",
	"scrim_cancelled",
	"scrim_disputed",
	"scrim_resolved",
	"scrim_rescheduled",
	"scrim_started",
	"scrim_result_reported",
	"scrim_reminder",
	"recruitment_application",
	"recruitment_accepted",
	"recruitment_rejected",
	"recruitment_withdrawn",
	"ocr_completed",
	"ocr_failed",
	"dispute_opened",
	"dispute_resolved",
	"sr_updated",
	"new_message",
	"channel_invite",
	"email_change_requested",
	"account_deletion_requested",
	"new_device_login",
	"new_location_login",
	"session_revoked_alert",
	"generic",
	"team_invite_received",
	"team_invite_accepted",
	"org_invite_received",
]);
