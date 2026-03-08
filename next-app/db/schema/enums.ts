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

/** LFG post direction. */
export const lfgTypeEnum = pgEnum("lfg_type", ["team_seeking_player", "player_seeking_team"]);

export const lfgStatusEnum = pgEnum("lfg_status", ["open", "closed", "fulfilled", "expired"]);

/** RBAC roles within an organization. */
export const orgRoleEnum = pgEnum("org_role", ["owner", "manager", "coach", "analyst", "player"]);

/** Roster slot status — tracks whether a player is actively competing. */
export const rosterStatusEnum = pgEnum("roster_status", ["active", "benched", "trial", "inactive"]);

/** OCR async job lifecycle. */
export const ocrJobStatusEnum = pgEnum("ocr_job_status", [
	"queued",
	"processing",
	"completed",
	"failed",
	"requires_review",
]);

/** Chat channel context — determines access rules and lifecycle. */
export const channelTypeEnum = pgEnum("channel_type", [
	"scrim_lobby", // Created when a scrim is accepted. Members: both teams' rosters.
	"scrim_negotiation", // Created when a scrim request is sent (pre-accept). Members: both managers.
	"team", // Persistent team-internal chat. Members: active roster + coaches.
	"recruitment", // Created per LFG application. Members: applicant + team managers.
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

/** LFG application lifecycle. */
export const lfgApplicationStatusEnum = pgEnum("lfg_application_status", [
	"pending",
	"accepted",
	"rejected",
	"withdrawn",
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
	"account_deletion_request",
	"account_deletion_confirm",
	"account_deletion_cancel",
	"session_revoked",
	"new_device_detected",
	"new_location_detected",
]);

/** Notification delivery channel. */
export const notificationTypeEnum = pgEnum("notification_type", [
	"scrim_request",
	"scrim_accepted",
	"scrim_cancelled",
	"scrim_reminder",
	"recruitment_application",
	"recruitment_accepted",
	"recruitment_rejected",
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
]);
