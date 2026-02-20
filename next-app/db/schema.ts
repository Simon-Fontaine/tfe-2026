import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

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

// ============================================================================
// AUTH — Identity, sessions, credentials, devices, audit
// ============================================================================

/**
 * Core user entity. `passwordHash` and `recoveryCode` are nullable to support
 * passkey-only registration. `isBanned` is a hard auth lock distinct from
 * org-level membership removal. Avatar, banner, and social links live here
 * because they are identity-level, not game-specific.
 */
export const userTable = pgTable(
	"user",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").notNull().unique(),
		username: text("username").notNull().unique(),

		/** Cosmetic display name shown in the UI. */
		displayName: text("display_name").notNull(),

		/** Nullable — passkey-only users may never set a password. */
		passwordHash: text("password_hash"),

		emailVerified: boolean("email_verified").notNull().default(false),

		/** Nullable — only set when TOTP 2FA is enabled. */
		recoveryCode: text("recovery_code"),

		// ---- Vanity profile fields ----

		/** Profile avatar URL. */
		avatarUrl: text("avatar_url"),

		/** Profile banner image URL. */
		bannerUrl: text("banner_url"),

		/** Short bio on public profile. */
		bio: text("bio"),

		/**
		 * Social links as JSONB key-value pairs.
		 * Example: `{ discord: "Hestia#1234", twitter: "@hestia" }`
		 */
		socialLinks: jsonb("social_links").$type<Record<string, string>>().default({}),

		/** Platform-wide ban flag. Checked at auth time. */
		isBanned: boolean("is_banned").notNull().default(false),

		/** Reason for ban, shown to the user on login attempt. */
		banReason: text("ban_reason"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("user_email_idx").on(table.email),
		uniqueIndex("user_username_idx").on(table.username),
	]
);

/**
 * Tracks all sessions, past and present. Sessions are never deleted during normal
 * operation — they are soft-revoked via `revokedAt`. This preserves a complete
 * login history for security dashboards and audit trails. Sessions are deleted
 * only via CASCADE when the user account is purged (GDPR).
 */
export const sessionTable = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		twoFactorVerified: boolean("two_factor_verified").notNull().default(false),

		// ---- Security metadata (captured at login) ----

		/** Client IP at session creation. */
		ipAddress: text("ip_address"),

		/** Raw User-Agent header. */
		userAgent: text("user_agent"),

		/**
		 * Links to the known device record. Created on first login from this device,
		 * reused on subsequent logins. A missing match triggers a "new device" alert.
		 */
		deviceId: uuid("device_id").references(() => userDeviceTable.id, { onDelete: "set null" }),

		/** GeoIP country code (ISO 3166-1 alpha-2). */
		geoCountry: text("geo_country"),

		/** GeoIP city name. */
		geoCity: text("geo_city"),

		/** GeoIP latitude. */
		geoLat: text("geo_lat"),

		/** GeoIP longitude. */
		geoLon: text("geo_lon"),

		// ---- Activity tracking ----

		/** Updated on each authenticated request (throttled to once per 5 min). */
		lastActiveAt: timestamp("last_active_at", { mode: "date" }).notNull().defaultNow(),

		// ---- Revocation (soft-delete) ----

		/** Revocation timestamp. Null means active. */
		revokedAt: timestamp("revoked_at", { mode: "date" }),

		/** Revocation reason, powers the security dashboard. */
		revocationReason: sessionRevocationReasonEnum("revocation_reason"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// "All active sessions for this user" — the session management page
		index("session_user_active_idx").on(table.userId, table.revokedAt, table.expiresAt),
		// "Full login history for this user" — security audit page
		index("session_user_history_idx").on(table.userId, table.createdAt),
		// "Sessions from this device" — for device trust verification
		index("session_device_idx").on(table.deviceId),
		// Cleanup job: find sessions that expired but haven't been marked
		index("session_expiry_idx").on(table.expiresAt, table.revokedAt),
	]
);

export const emailVerificationRequestTable = pgTable(
	"email_verification_request",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		code: text("code").notNull(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),

		/** Requester IP for abuse detection. */
		ipAddress: text("ip_address"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("email_verification_user_idx").on(table.userId)]
);

export const passwordResetSessionTable = pgTable(
	"password_reset_session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		code: text("code").notNull(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		emailVerified: boolean("email_verified").notNull().default(false),
		twoFactorVerified: boolean("two_factor_verified").notNull().default(false),

		/** Requester IP for abuse detection. */
		ipAddress: text("ip_address"),

		/** Requester User-Agent. */
		userAgent: text("user_agent"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("password_reset_user_idx").on(table.userId)]
);

export const totpCredentialTable = pgTable(
	"totp_credential",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => userTable.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("totp_user_idx").on(table.userId)]
);

export const passkeyCredentialTable = pgTable(
	"passkey_credential",
	{
		id: text("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		algorithm: integer("algorithm").notNull(),
		publicKey: text("public_key").notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("passkey_user_idx").on(table.userId)]
);

export const securityKeyCredentialTable = pgTable(
	"security_key_credential",
	{
		id: text("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		algorithm: integer("algorithm").notNull(),
		publicKey: text("public_key").notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("security_key_user_idx").on(table.userId)]
);

// ============================================================================
// USER DEVICES — Known device registry for security alerts
// ============================================================================

/**
 * Registry of known devices per user. On each login, a fingerprint is computed
 * from the User-Agent and matched here. An unknown fingerprint triggers a
 * "new device" security alert. The user can view and revoke devices from their
 * security dashboard.
 */
export const userDeviceTable = pgTable(
	"user_device",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/**
		 * SHA-256 hash of device characteristics (UA + client hints).
		 * Hashed to normalize minor version differences across logins.
		 */
		fingerprint: text("fingerprint").notNull(),

		/** Human-readable device name parsed from UA. */
		deviceName: text("device_name").notNull(),

		/** Parsed browser name. */
		browserName: text("browser_name"),

		/** Parsed OS name. */
		osName: text("os_name"),

		/** Device type inferred from UA. */
		deviceType: text("device_type"),

		/** First IP seen from this device. */
		firstIpAddress: text("first_ip_address"),

		/** Country of first login from this device. */
		firstGeoCountry: text("first_geo_country"),

		/** City of first login from this device. */
		firstGeoCity: text("first_geo_city"),

		/** Trusted devices skip certain security prompts. */
		isTrusted: boolean("is_trusted").notNull().default(false),

		/** Revocation timestamp. */
		revokedAt: timestamp("revoked_at", { mode: "date" }),

		firstSeenAt: timestamp("first_seen_at", { mode: "date" }).notNull().defaultNow(),
		lastSeenAt: timestamp("last_seen_at", { mode: "date" }).notNull().defaultNow(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// Primary lookup: "is this device known for this user?"
		uniqueIndex("user_device_fingerprint_idx").on(table.userId, table.fingerprint),
		// "All devices for this user" — security dashboard
		index("user_device_user_idx").on(table.userId, table.revokedAt),
	]
);

// ============================================================================
// AUDIT LOG — Immutable security event trail
// ============================================================================

/**
 * Append-only, immutable log of every security-relevant event on the platform.
 * Never updated or deleted (except by GDPR cascade). `metadata` is JSONB for
 * action-specific context. No foreign keys beyond `userId` so audit entries
 * remain stable across schema changes.
 */
export const auditLogTable = pgTable(
	"audit_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		action: auditActionEnum("action").notNull(),

		/** Client IP at event time. */
		ipAddress: text("ip_address"),

		/** User-Agent at event time. */
		userAgent: text("user_agent"),

		/** GeoIP country code at event time. */
		geoCountry: text("geo_country"),

		/** GeoIP city at event time. */
		geoCity: text("geo_city"),

		/** Action-specific context as JSONB. */
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),

		/** Immutable — no updatedAt. */
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// "My security activity log" — paginated by time
		index("audit_log_user_idx").on(table.userId, table.createdAt),
		// "All failed logins in the last hour" — rate limiting / brute-force detection
		index("audit_log_action_idx").on(table.action, table.createdAt),
		// "All events from this IP" — abuse investigation
		index("audit_log_ip_idx").on(table.ipAddress, table.createdAt),
	]
);

// ============================================================================
// VERIFICATION TABLES — Email change, account deletion, sensitive actions
// ============================================================================

/**
 * Two-step email change flow: a code is sent to the new email, then the app
 * swaps `userTable.email` once verified. Separate from signup verification
 * because both the old and new email are stored for audit and rollback.
 */
export const emailChangeVerificationTable = pgTable(
	"email_change_verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Current email at request time. */
		currentEmail: text("current_email").notNull(),

		/** New email the user wants to switch to. */
		newEmail: text("new_email").notNull(),

		/** Verification code sent to the new email. */
		code: text("code").notNull(),

		/** Requester IP. */
		ipAddress: text("ip_address"),

		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		verifiedAt: timestamp("verified_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("email_change_user_idx").on(table.userId),
		// Prevent multiple pending requests per user
		uniqueIndex("email_change_active_idx").on(table.userId, table.newEmail),
	]
);

/**
 * GDPR-compliant account deletion flow with a grace period. After the user
 * confirms with a code, a cron job purges the account at `scheduledDeletionAt`
 * unless cancelled first.
 */
export const accountDeletionRequestTable = pgTable(
	"account_deletion_request",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Confirmation code. */
		code: text("code").notNull(),

		/** Optional deletion reason for product feedback. */
		reason: text("reason"),

		/** Requester IP. */
		ipAddress: text("ip_address"),

		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		confirmedAt: timestamp("confirmed_at", { mode: "date" }),

		/** Scheduled deletion date after the grace period. */
		scheduledDeletionAt: timestamp("scheduled_deletion_at", { mode: "date" }),

		/** Cancellation timestamp during the grace period. */
		cancelledAt: timestamp("cancelled_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("account_deletion_user_idx").on(table.userId),
		// Cron job query: "find confirmed, non-cancelled deletions past their scheduled date"
		index("account_deletion_schedule_idx").on(table.scheduledDeletionAt, table.cancelledAt),
	]
);

/**
 * Short-lived verification (10–15 min TTL) for sensitive actions that require
 * a confirmation code beyond the standard session. One active request per user
 * per action.
 */
export const sensitiveActionVerificationTable = pgTable(
	"sensitive_action_verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		action: verificationActionEnum("action").notNull(),

		/** Verification code (6 digits or secure token). */
		code: text("code").notNull(),

		/** Optional action-specific metadata. */
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),

		/** Requester IP. */
		ipAddress: text("ip_address"),

		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		verifiedAt: timestamp("verified_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("sensitive_action_user_idx").on(table.userId),
		// One active verification per action type per user
		uniqueIndex("sensitive_action_active_idx").on(table.userId, table.action),
	]
);

// ============================================================================
// PLAYER PROFILE — Extends auth user with Overwatch 2-specific data
// ============================================================================

/**
 * OW2-specific profile data, one-to-one with `userTable`. Separated from auth
 * to keep the auth layer game-agnostic. `battletag` is optional until linked.
 * `heroPool` uses JSONB with a GIN index for LFG hero-pool matching.
 */
export const playerProfileTable = pgTable(
	"player_profile",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Blizzard BattleTag, optional until linked. */
		battletag: text("battletag"),

		/** Primary competitive role. */
		primaryRole: ow2RoleEnum("primary_role").notNull(),

		/** Secondary role for flex players. */
		secondaryRole: ow2RoleEnum("secondary_role"),

		/** Public competitive rank. */
		rank: ow2RankEnum("rank"),

		/** Rank division 1-5 within the tier (1 = highest). */
		rankDivision: smallint("rank_division"),

		/**
		 * Internal SR computed from scrim results on this platform. Starts at 1500.
		 * Updated only after both teams confirm a scrim result.
		 */
		internalSr: integer("internal_sr").notNull().default(1500),

		/** Glicko-2 rating deviation. */
		srDeviation: integer("sr_deviation").notNull().default(350),

		/** Preferred heroes array, GIN-indexed for LFG queries. */
		heroPool: jsonb("hero_pool").$type<string[]>().notNull().default([]),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("player_profile_user_idx").on(table.userId),
		index("player_profile_battletag_idx").on(table.battletag),
		// LFG query: "find all support players in diamond+ with SR > X"
		index("player_profile_lfg_idx").on(table.primaryRole, table.rank, table.internalSr),
		// Matchmaking: fast SR-range lookups
		index("player_profile_sr_idx").on(table.internalSr),
	]
);

// ============================================================================
// ORGANIZATIONS — Multi-tenant root entity
// ============================================================================

/**
 * Multi-tenant root entity that owns one or more teams. `slug` is the
 * URL-friendly unique identifier (e.g. `/org/team-liquid`).
 */
export const organizationTable = pgTable(
	"organization",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		description: text("description"),
		avatarUrl: text("avatar_url"),
		bannerUrl: text("banner_url"),

		/** Org creator. Denormalized for fast access. */
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("organization_slug_idx").on(table.slug)]
);

// ============================================================================
// ORGANIZATION MEMBERS — RBAC bridge between users and organizations
// ============================================================================

/**
 * RBAC bridge between users and organizations. A user may belong to multiple
 * organizations, each with a distinct role.
 */
export const organizationMemberTable = pgTable(
	"organization_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: orgRoleEnum("role").notNull().default("player"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("org_member_unique_idx").on(table.organizationId, table.userId),
		index("org_member_user_idx").on(table.userId),
	]
);

// ============================================================================
// TEAMS — A roster within an organization
// ============================================================================

/**
 * A competitive roster owned by an organization. `teamSr` is a composite rating
 * updated after confirmed scrims. Archived teams are hidden from matchmaking.
 */
export const teamTable = pgTable(
	"team",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tag: text("tag").notNull(), // short clan tag, e.g. "TL"
		description: text("description"),
		avatarUrl: text("avatar_url"),

		/** Composite team SR for matchmaking. */
		teamSr: integer("team_sr").notNull().default(1500),
		srDeviation: integer("sr_deviation").notNull().default(350),

		/** Completed scrim count for SR calibration. */
		matchesPlayed: integer("matches_played").notNull().default(0),

		/** Archived teams are hidden from matchmaking. */
		isArchived: boolean("is_archived").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("team_org_idx").on(table.organizationId),
		// Matchmaking: "find active teams in SR range"
		index("team_matchmaking_idx").on(table.teamSr, table.isArchived),
	]
);

// ============================================================================
// TEAM ROSTER — Many-to-many between teams and players
// ============================================================================

/**
 * Many-to-many between teams and players. A player may be on multiple teams
 * (e.g. main + academy) with a different role per roster.
 */
export const teamRosterTable = pgTable(
	"team_roster",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Role on this specific team. */
		roleInTeam: ow2RoleEnum("role_in_team").notNull(),
		status: rosterStatusEnum("status").notNull().default("active"),

		/** Join date, distinct from createdAt for transfer tracking. */
		joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
		leftAt: timestamp("left_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// A player can only hold one active slot per team
		uniqueIndex("team_roster_unique_idx").on(table.teamId, table.userId),
		index("team_roster_user_idx").on(table.userId),
		// Quickly list active roster for a team
		index("team_roster_active_idx").on(table.teamId, table.status),
	]
);

// ============================================================================
// LFG POSTS — Bidirectional Looking-For-Group
// ============================================================================

/**
 * Bidirectional LFG posts. `team_seeking_player` sets `teamId`; `player_seeking_team`
 * leaves it null. `heroPoolFilter` uses a GIN index for hero-based matching.
 */
export const lfgPostTable = pgTable(
	"lfg_post",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		type: lfgTypeEnum("type").notNull(),
		status: lfgStatusEnum("status").notNull().default("open"),

		/** User who created the post. */
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Set only for team_seeking_player posts. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		/** Target roles as JSONB array. */
		rolesNeeded: jsonb("roles_needed").$type<string[]>().notNull().default([]),

		/** Minimum acceptable rank tier. */
		minRank: ow2RankEnum("min_rank"),

		/** Maximum acceptable rank tier. */
		maxRank: ow2RankEnum("max_rank"),

		/** Minimum internal SR. */
		minSr: integer("min_sr"),

		/** Maximum internal SR. */
		maxSr: integer("max_sr"),

		/** Hero pool filter, GIN-indexed. */
		heroPoolFilter: jsonb("hero_pool_filter").$type<string[]>().default([]),

		/** Freeform description / requirements. */
		description: text("description"),

		/** Region preference. */
		region: text("region"),

		/** Auto-expiry date (typically now + 7 days). */
		expiresAt: timestamp("expires_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Primary LFG feed query: open posts of a given type
		index("lfg_feed_idx").on(table.type, table.status),
		// Filter by role + rank range for the "find me a support" queries
		index("lfg_role_rank_idx").on(table.status, table.minRank, table.maxRank),
		// SR-range matching for internal matchmaking-aware LFG
		index("lfg_sr_range_idx").on(table.status, table.minSr, table.maxSr),
		// My posts
		index("lfg_user_idx").on(table.userId),
		index("lfg_team_idx").on(table.teamId),
	]
);

/** Applications and responses to LFG posts, from players or teams. */
export const lfgApplicationTable = pgTable(
	"lfg_application",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		postId: uuid("post_id")
			.notNull()
			.references(() => lfgPostTable.id, { onDelete: "cascade" }),

		/** User who is applying or reaching out. */
		applicantUserId: uuid("applicant_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Applicant team for team-initiated outreach. */
		applicantTeamId: uuid("applicant_team_id").references(() => teamTable.id, {
			onDelete: "cascade",
		}),

		message: text("message"),
		status: lfgApplicationStatusEnum("status").notNull().default("pending"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Prevent duplicate applications
		uniqueIndex("lfg_app_unique_idx").on(table.postId, table.applicantUserId),
		index("lfg_app_post_idx").on(table.postId),
		index("lfg_app_user_idx").on(table.applicantUserId),
	]
);

// ============================================================================
// AVAILABILITY — Player scheduling windows for auto-suggesting scrim times
// ============================================================================

/**
 * Recurring or one-off availability windows for scheduling scrims.
 * `dayOfWeek` + `startTime`/`endTime` define a recurring pattern;
 * `specificDate` overrides it for one-off slots.
 */
export const availabilityTable = pgTable(
	"availability",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Day of the week (0=Sun, 6=Sat). Null for one-off slots. */
		dayOfWeek: smallint("day_of_week"),

		/** Specific date override. Null for recurring slots. */
		specificDate: timestamp("specific_date", { mode: "date" }),

		/** Start time as "HH:MM" in the player's timezone. */
		startTime: text("start_time").notNull(),

		/** End time as "HH:MM". */
		endTime: text("end_time").notNull(),

		/** IANA timezone string. */
		timezone: text("timezone").notNull().default("UTC"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("availability_user_idx").on(table.userId),
		index("availability_schedule_idx").on(table.userId, table.dayOfWeek),
		index("availability_specific_idx").on(table.userId, table.specificDate),
	]
);

// ============================================================================
// SCRIMS — The match entity between two teams
// ============================================================================

/**
 * A scrim between two teams. `homeTeamId` is the requester; `awayTeamId` is
 * the opponent. Lifecycle: pending → accepted → scheduled → in_progress →
 * awaiting_confirmation → completed | disputed. `config` stores flexible
 * settings (map pool, best-of, hero restrictions) as JSONB.
 */
export const scrimTable = pgTable(
	"scrim",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		homeTeamId: uuid("home_team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "restrict" }),
		awayTeamId: uuid("away_team_id").references(() => teamTable.id, { onDelete: "restrict" }),

		status: scrimStatusEnum("status").notNull().default("pending"),

		/** Flexible scrim configuration as JSONB. */
		config: jsonb("config")
			.$type<{
				mapPool?: string[];
				bestOf?: number;
				heroRestrictions?: string[];
				format?: string;
			}>()
			.default({}),

		/** Scheduling */
		scheduledAt: timestamp("scheduled_at", { mode: "date" }),
		startedAt: timestamp("started_at", { mode: "date" }),
		endedAt: timestamp("ended_at", { mode: "date" }),

		/** Series score computed from confirmed map results. */
		homeMapScore: smallint("home_map_score").notNull().default(0),
		awayMapScore: smallint("away_map_score").notNull().default(0),

		/** SR delta applied after confirmation. */
		srDelta: integer("sr_delta"),

		/** Dispute resolution outcome. */
		disputeResolution: disputeResolutionEnum("dispute_resolution"),

		/** Admin who resolved the dispute. */
		disputeResolvedByUserId: uuid("dispute_resolved_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		/** Timestamp of dispute resolution. */
		disputeResolvedAt: timestamp("dispute_resolved_at", { mode: "date" }),

		/** Admin notes on the dispute resolution. */
		disputeNotes: text("dispute_notes"),

		/** User who created this scrim request. */
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		/** Optional message from the requester. */
		message: text("message"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("scrim_home_team_idx").on(table.homeTeamId),
		index("scrim_away_team_idx").on(table.awayTeamId),
		index("scrim_status_idx").on(table.status),
		// "upcoming scrims" query
		index("scrim_schedule_idx").on(table.status, table.scheduledAt),
		// History for a specific team
		index("scrim_team_history_idx").on(table.homeTeamId, table.status, table.scheduledAt),
	]
);

// ============================================================================
// SCRIM CONFIRMATIONS — Both teams must confirm before SR is updated
// ============================================================================

/**
 * Post-scrim result confirmation. One row per team per scrim. Both teams must
 * confirm before SR is updated; a dispute from either side triggers admin review.
 */
export const scrimConfirmationTable = pgTable(
	"scrim_confirmation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		status: confirmationStatusEnum("status").notNull().default("pending"),

		/** Dispute reason, if applicable. */
		disputeReason: text("dispute_reason"),

		/** User who submitted the confirmation. */
		confirmedByUserId: uuid("confirmed_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		confirmedAt: timestamp("confirmed_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// One confirmation per team per scrim
		uniqueIndex("scrim_confirm_unique_idx").on(table.scrimId, table.teamId),
		index("scrim_confirm_scrim_idx").on(table.scrimId),
	]
);

// ============================================================================
// SCRIM MAPS — Per-map results within a scrim (matches the OCR "matches" output)
// ============================================================================

/**
 * One row per map played within a scrim. `result` is from the home team's
 * perspective. `durationSeconds` is parsed from the OCR "MM:SS" string in
 * the application layer.
 */
export const scrimMapTable = pgTable(
	"scrim_map",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		/** 1-indexed position in the series. */
		mapOrder: smallint("map_order").notNull(),

		/** Map name normalized to Title Case. */
		mapName: text("map_name").notNull(),

		/** Core mode type. */
		mapType: mapTypeEnum("map_type").notNull(),

		/** Queue / lobby type. */
		gameMode: gameModeEnum("game_mode").notNull().default("custom_game"),

		/** Duration in seconds, parsed from OCR "MM:SS". */
		durationSeconds: integer("duration_seconds"),

		/** Result from the home team's perspective. */
		result: matchResultEnum("result").notNull(),

		/** Home team round score on this map. */
		homeScore: smallint("home_score").notNull().default(0),

		/** Away team round score on this map. */
		awayScore: smallint("away_score").notNull().default(0),

		/** OCR job that extracted this data. */
		ocrJobId: uuid("ocr_job_id").references(() => ocrJobTable.id, { onDelete: "set null" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// Enforce one entry per map position per scrim
		uniqueIndex("scrim_map_order_idx").on(table.scrimId, table.mapOrder),
		index("scrim_map_scrim_idx").on(table.scrimId),
		// Analytics: "win rate on King's Row"
		index("scrim_map_name_idx").on(table.mapName, table.result),
		index("scrim_map_type_idx").on(table.mapType),
	]
);

// ============================================================================
// SCRIM PLAYER STATS — Per-player per-map stats (matches OCR "teams.players" output)
// ============================================================================

/**
 * Full stat line per player per map, sourced from OCR output. `userId` is
 * nullable for opponents not registered on the platform. `playerName` is
 * always the raw OCR-extracted value.
 */
export const scrimPlayerStatTable = pgTable(
	"scrim_player_stat",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimMapId: uuid("scrim_map_id")
			.notNull()
			.references(() => scrimMapTable.id, { onDelete: "cascade" }),

		/** Which side: home or away. */
		side: text("side").notNull(), // "home" | "away"

		/** Resolved platform user. Null for unregistered opponents. */
		userId: uuid("user_id").references(() => userTable.id, { onDelete: "set null" }),

		/** Platform team. Null for unregistered opponents. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "set null" }),

		/** Raw player name from OCR. */
		playerName: text("player_name").notNull(),

		/** Hero played on this map. */
		hero: text("hero").notNull(),

		/** Role played on this map. */
		role: ow2RoleEnum("role").notNull(),

		// ---- Core stat columns (direct from OCR) ----
		eliminations: integer("eliminations").notNull().default(0),
		assists: integer("assists").notNull().default(0),
		deaths: integer("deaths").notNull().default(0),
		damage: integer("damage").notNull().default(0),
		healing: integer("healing").notNull().default(0),
		mitigation: integer("mitigation").notNull().default(0),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("player_stat_map_idx").on(table.scrimMapId),
		// "Show all my stats across all scrims"
		index("player_stat_user_idx").on(table.userId),
		// "Performance on a specific hero across all scrims"
		index("player_stat_hero_idx").on(table.userId, table.hero),
		// Per-team stats aggregation
		index("player_stat_team_idx").on(table.teamId),
		// Prevent duplicate stat rows per player per map
		uniqueIndex("player_stat_unique_idx").on(table.scrimMapId, table.playerName, table.side),
	]
);

// ============================================================================
// SR HISTORY — Audit trail for internal rating changes
// ============================================================================

/**
 * Immutable SR change log for both players and teams. `entityType` + `entityId`
 * form a polymorphic reference to either `playerProfile.id` or `team.id`.
 */
export const srHistoryTable = pgTable(
	"sr_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		/** "player" or "team". */
		entityType: text("entity_type").notNull(),

		/** UUID of the player_profile or team row. */
		entityId: uuid("entity_id").notNull(),

		/** Scrim that triggered this SR change. */
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		srBefore: integer("sr_before").notNull(),
		srAfter: integer("sr_after").notNull(),
		srDelta: integer("sr_delta").notNull(),

		/** Deviation before and after (Glicko-2). */
		deviationBefore: integer("deviation_before"),
		deviationAfter: integer("deviation_after"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("sr_history_entity_idx").on(table.entityType, table.entityId),
		index("sr_history_scrim_idx").on(table.scrimId),
		// Timeline query: "show my SR graph"
		index("sr_history_timeline_idx").on(table.entityType, table.entityId, table.createdAt),
	]
);

// ============================================================================
// OCR JOBS — Async processing pipeline tracking
// ============================================================================

/**
 * Lifecycle tracker for each screenshot submitted for AI/OCR processing.
 * `rawOcrOutput` stores the full JSON response for audit and re-processing.
 */
export const ocrJobTable = pgTable(
	"ocr_job",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		/** User who uploaded the screenshot. */
		submittedByUserId: uuid("submitted_by_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		/** Screenshot type: "game_history" or "scoreboard". */
		screenshotType: text("screenshot_type").notNull(),

		/** Image URL in object storage. */
		imageUrl: text("image_url").notNull(),

		status: ocrJobStatusEnum("status").notNull().default("queued"),

		/** Full OCR JSON response for audit and re-processing. */
		rawOcrOutput: jsonb("raw_ocr_output"),

		/** Error message if the job failed. */
		errorMessage: text("error_message"),

		/** Processing duration in milliseconds. */
		processingTimeMs: integer("processing_time_ms"),

		/** Number of retry attempts. */
		retryCount: smallint("retry_count").notNull().default(0),

		startedAt: timestamp("started_at", { mode: "date" }),
		completedAt: timestamp("completed_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ocr_job_scrim_idx").on(table.scrimId),
		index("ocr_job_status_idx").on(table.status),
		index("ocr_job_user_idx").on(table.submittedByUserId),
	]
);

// ============================================================================
// NOTIFICATIONS — Async notification queue
// ============================================================================

export const notificationTable = pgTable(
	"notification",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		/** Recipient. */
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		type: notificationTypeEnum("type").notNull(),
		title: text("title").notNull(),
		body: text("body"),

		/** Polymorphic reference to the source entity. */
		referenceType: text("reference_type"), // "scrim" | "lfg_post" | "lfg_application" | etc.
		referenceId: uuid("reference_id"),

		isRead: boolean("is_read").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// "My unread notifications" — the primary inbox query
		index("notification_inbox_idx").on(table.userId, table.isRead, table.createdAt),
		index("notification_user_idx").on(table.userId),
	]
);

// ============================================================================
// MESSAGING — Channel-based chat system
// ============================================================================

/**
 * Conversation container with typed context. Five channel types drive different
 * access rules and lifecycles. Only the relevant polymorphic FK (`scrimId`,
 * `teamId`, `lfgApplicationId`) is set per channel. Archived channels are
 * read-only. Socket.io rooms map 1:1 to channel IDs as `channel:{id}`.
 */
export const chatChannelTable = pgTable(
	"chat_channel",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelType: channelTypeEnum("channel_type").notNull(),

		/** Channel name, auto-generated or custom. */
		name: text("name").notNull(),

		// ---- Polymorphic context references (only one is set per channel) ----

		/** Set for scrim_negotiation and scrim_lobby channels. */
		scrimId: uuid("scrim_id").references(() => scrimTable.id, { onDelete: "cascade" }),

		/** Set for team channels. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		/** Set for recruitment channels. */
		lfgApplicationId: uuid("lfg_application_id").references(() => lfgApplicationTable.id, {
			onDelete: "cascade",
		}),

		/** Archived channels are read-only. */
		isArchived: boolean("is_archived").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// "All channels for this scrim" (negotiation + lobby)
		index("chat_channel_scrim_idx").on(table.scrimId),
		// "Team chat channel"
		index("chat_channel_team_idx").on(table.teamId),
		// "Recruitment thread for this application"
		index("chat_channel_lfg_app_idx").on(table.lfgApplicationId),
		// "List active channels by type"
		index("chat_channel_type_idx").on(table.channelType, table.isArchived),
	]
);

/**
 * Channel membership controlling read/write access. `lastReadAt` powers unread
 * counts. Members are soft-removed via `leftAt` to preserve message history.
 */
export const chatChannelMemberTable = pgTable(
	"chat_channel_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelId: uuid("channel_id")
			.notNull()
			.references(() => chatChannelTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Channel-scoped role. */
		role: text("role").notNull().default("member"),

		/** Last read timestamp for the unread badge. */
		lastReadAt: timestamp("last_read_at", { mode: "date" }),

		/** Left timestamp. Null means active. */
		leftAt: timestamp("left_at", { mode: "date" }),

		/** Muted members receive no push or SSE notifications. */
		isMuted: boolean("is_muted").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// One membership per user per channel
		uniqueIndex("chat_member_unique_idx").on(table.channelId, table.userId),
		// "All my active channels" — the sidebar query
		index("chat_member_user_idx").on(table.userId, table.leftAt),
		// "All active members of this channel"
		index("chat_member_channel_idx").on(table.channelId, table.leftAt),
	]
);

/**
 * Append-only chat messages. Edits update `content` and set `editedAt`.
 * Soft-deleted via `deletedAt` (content shown as "[deleted]").
 * `replyToMessageId` enables quote-replies.
 */
export const chatMessageTable = pgTable(
	"chat_message",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelId: uuid("channel_id")
			.notNull()
			.references(() => chatChannelTable.id, { onDelete: "cascade" }),
		senderId: uuid("sender_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Message content (markdown-lite). */
		content: text("content").notNull(),

		/** Quote-reply parent message. */
		replyToMessageId: uuid("reply_to_message_id"),

		/** Single attachment URL. */
		attachmentUrl: text("attachment_url"),

		/** System-generated message flag. */
		isSystemMessage: boolean("is_system_message").notNull().default(false),

		/** Soft-delete timestamp. Content shown as "[deleted]". */
		deletedAt: timestamp("deleted_at", { mode: "date" }),

		/** Edit timestamp. Null means never edited. */
		editedAt: timestamp("edited_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// Primary chat query: "last N messages in this channel, newest first"
		// Supports cursor-based pagination: WHERE channel_id = $id AND created_at < $cursor
		index("chat_message_channel_idx").on(table.channelId, table.createdAt),
		// "All messages by this user" — for moderation / GDPR data export
		index("chat_message_sender_idx").on(table.senderId),
		// Thread view: "all replies to this message"
		index("chat_message_reply_idx").on(table.replyToMessageId),
	]
);

// ============================================================================
// RELATIONS — Drizzle relational query builder definitions
// ============================================================================

export const userRelations = relations(userTable, ({ one, many }) => ({
	profile: one(playerProfileTable, {
		fields: [userTable.id],
		references: [playerProfileTable.userId],
	}),
	sessions: many(sessionTable),
	devices: many(userDeviceTable),
	auditLogs: many(auditLogTable),
	organizationMemberships: many(organizationMemberTable),
	teamRosters: many(teamRosterTable),
	availabilities: many(availabilityTable),
	notifications: many(notificationTable),
	lfgPosts: many(lfgPostTable),
	lfgApplications: many(lfgApplicationTable),
	chatChannelMemberships: many(chatChannelMemberTable),
	chatMessages: many(chatMessageTable),
	emailChangeVerifications: many(emailChangeVerificationTable),
	accountDeletionRequests: many(accountDeletionRequestTable),
	sensitiveActionVerifications: many(sensitiveActionVerificationTable),
}));

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
	device: one(userDeviceTable, {
		fields: [sessionTable.deviceId],
		references: [userDeviceTable.id],
	}),
}));

export const playerProfileRelations = relations(playerProfileTable, ({ one }) => ({
	user: one(userTable, {
		fields: [playerProfileTable.userId],
		references: [userTable.id],
	}),
}));

export const organizationRelations = relations(organizationTable, ({ one, many }) => ({
	owner: one(userTable, {
		fields: [organizationTable.ownerId],
		references: [userTable.id],
	}),
	members: many(organizationMemberTable),
	teams: many(teamTable),
}));

export const organizationMemberRelations = relations(organizationMemberTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [organizationMemberTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [organizationMemberTable.userId],
		references: [userTable.id],
	}),
}));

export const teamRelations = relations(teamTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [teamTable.organizationId],
		references: [organizationTable.id],
	}),
	roster: many(teamRosterTable),
	homeScrims: many(scrimTable, { relationName: "homeTeamScrims" }),
	awayScrims: many(scrimTable, { relationName: "awayTeamScrims" }),
	confirmations: many(scrimConfirmationTable),
	lfgPosts: many(lfgPostTable),
	chatChannels: many(chatChannelTable, { relationName: "teamChatChannels" }),
}));

export const teamRosterRelations = relations(teamRosterTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamRosterTable.teamId],
		references: [teamTable.id],
	}),
	user: one(userTable, {
		fields: [teamRosterTable.userId],
		references: [userTable.id],
	}),
}));

export const lfgPostRelations = relations(lfgPostTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [lfgPostTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [lfgPostTable.teamId],
		references: [teamTable.id],
	}),
	applications: many(lfgApplicationTable),
}));

export const lfgApplicationRelations = relations(lfgApplicationTable, ({ one, many }) => ({
	post: one(lfgPostTable, {
		fields: [lfgApplicationTable.postId],
		references: [lfgPostTable.id],
	}),
	applicant: one(userTable, {
		fields: [lfgApplicationTable.applicantUserId],
		references: [userTable.id],
	}),
	applicantTeam: one(teamTable, {
		fields: [lfgApplicationTable.applicantTeamId],
		references: [teamTable.id],
	}),
	chatChannels: many(chatChannelTable, { relationName: "recruitmentChatChannels" }),
}));

export const availabilityRelations = relations(availabilityTable, ({ one }) => ({
	user: one(userTable, {
		fields: [availabilityTable.userId],
		references: [userTable.id],
	}),
}));

export const scrimRelations = relations(scrimTable, ({ one, many }) => ({
	homeTeam: one(teamTable, {
		fields: [scrimTable.homeTeamId],
		references: [teamTable.id],
		relationName: "homeTeamScrims",
	}),
	awayTeam: one(teamTable, {
		fields: [scrimTable.awayTeamId],
		references: [teamTable.id],
		relationName: "awayTeamScrims",
	}),
	createdBy: one(userTable, {
		fields: [scrimTable.createdByUserId],
		references: [userTable.id],
	}),
	maps: many(scrimMapTable),
	confirmations: many(scrimConfirmationTable),
	ocrJobs: many(ocrJobTable),
	srHistory: many(srHistoryTable),
	chatChannels: many(chatChannelTable, { relationName: "scrimChatChannels" }),
}));

export const scrimConfirmationRelations = relations(scrimConfirmationTable, ({ one }) => ({
	scrim: one(scrimTable, {
		fields: [scrimConfirmationTable.scrimId],
		references: [scrimTable.id],
	}),
	team: one(teamTable, {
		fields: [scrimConfirmationTable.teamId],
		references: [teamTable.id],
	}),
	confirmedBy: one(userTable, {
		fields: [scrimConfirmationTable.confirmedByUserId],
		references: [userTable.id],
	}),
}));

export const scrimMapRelations = relations(scrimMapTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [scrimMapTable.scrimId],
		references: [scrimTable.id],
	}),
	ocrJob: one(ocrJobTable, {
		fields: [scrimMapTable.ocrJobId],
		references: [ocrJobTable.id],
	}),
	playerStats: many(scrimPlayerStatTable),
}));

export const scrimPlayerStatRelations = relations(scrimPlayerStatTable, ({ one }) => ({
	scrimMap: one(scrimMapTable, {
		fields: [scrimPlayerStatTable.scrimMapId],
		references: [scrimMapTable.id],
	}),
	user: one(userTable, {
		fields: [scrimPlayerStatTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [scrimPlayerStatTable.teamId],
		references: [teamTable.id],
	}),
}));

export const srHistoryRelations = relations(srHistoryTable, ({ one }) => ({
	scrim: one(scrimTable, {
		fields: [srHistoryTable.scrimId],
		references: [scrimTable.id],
	}),
}));

export const ocrJobRelations = relations(ocrJobTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [ocrJobTable.scrimId],
		references: [scrimTable.id],
	}),
	submittedBy: one(userTable, {
		fields: [ocrJobTable.submittedByUserId],
		references: [userTable.id],
	}),
	extractedMaps: many(scrimMapTable),
}));

export const notificationRelations = relations(notificationTable, ({ one }) => ({
	user: one(userTable, {
		fields: [notificationTable.userId],
		references: [userTable.id],
	}),
}));

// ---- Chat relations ----

export const chatChannelRelations = relations(chatChannelTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [chatChannelTable.scrimId],
		references: [scrimTable.id],
		relationName: "scrimChatChannels",
	}),
	team: one(teamTable, {
		fields: [chatChannelTable.teamId],
		references: [teamTable.id],
		relationName: "teamChatChannels",
	}),
	lfgApplication: one(lfgApplicationTable, {
		fields: [chatChannelTable.lfgApplicationId],
		references: [lfgApplicationTable.id],
		relationName: "recruitmentChatChannels",
	}),
	members: many(chatChannelMemberTable),
	messages: many(chatMessageTable),
}));

export const chatChannelMemberRelations = relations(chatChannelMemberTable, ({ one }) => ({
	channel: one(chatChannelTable, {
		fields: [chatChannelMemberTable.channelId],
		references: [chatChannelTable.id],
	}),
	user: one(userTable, {
		fields: [chatChannelMemberTable.userId],
		references: [userTable.id],
	}),
}));

export const chatMessageRelations = relations(chatMessageTable, ({ one }) => ({
	channel: one(chatChannelTable, {
		fields: [chatMessageTable.channelId],
		references: [chatChannelTable.id],
	}),
	sender: one(userTable, {
		fields: [chatMessageTable.senderId],
		references: [userTable.id],
	}),
	replyTo: one(chatMessageTable, {
		fields: [chatMessageTable.replyToMessageId],
		references: [chatMessageTable.id],
	}),
}));

// ---- Verification relations ----

export const emailChangeVerificationRelations = relations(
	emailChangeVerificationTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [emailChangeVerificationTable.userId],
			references: [userTable.id],
		}),
	})
);

export const accountDeletionRequestRelations = relations(
	accountDeletionRequestTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [accountDeletionRequestTable.userId],
			references: [userTable.id],
		}),
	})
);

export const sensitiveActionVerificationRelations = relations(
	sensitiveActionVerificationTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [sensitiveActionVerificationTable.userId],
			references: [userTable.id],
		}),
	})
);

// ---- Device & audit relations ----

export const userDeviceRelations = relations(userDeviceTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [userDeviceTable.userId],
		references: [userTable.id],
	}),
	sessions: many(sessionTable),
}));

export const auditLogRelations = relations(auditLogTable, ({ one }) => ({
	user: one(userTable, {
		fields: [auditLogTable.userId],
		references: [userTable.id],
	}),
}));
