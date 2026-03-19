import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { sessionRevocationReasonEnum, verificationActionEnum } from "./enums";
// ============================================================================
// AUTH — Identity, sessions, credentials, devices, audit

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
	(table) => [
		index("email_verification_user_idx").on(table.userId),
		index("email_verification_code_idx").on(table.code),
	]
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
		/**
		 * The TOTP counter window (floor(unix_seconds / 30)) that was last
		 * successfully verified. Any code whose window ≤ this value is rejected,
		 * closing the replay-attack window that exists when the same 30-second
		 * code is submitted twice. Null means no code has been used yet.
		 *
		 * Migration note: ALTER TABLE totp_credential
		 *                 ADD COLUMN last_used_counter BIGINT;
		 */
		lastUsedCounter: bigint("last_used_counter", { mode: "bigint" }),
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
		/**
		 * Signature counter from the authenticator. The server must reject
		 * assertions where the counter does not increase, as that indicates
		 * a cloned authenticator (WebAuthn §6.1.1 step 21).
		 */
		signCount: bigint("sign_count", { mode: "bigint" }).notNull().default(sql`0`),
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
		/**
		 * Signature counter from the authenticator. The server must reject
		 * assertions where the counter does not increase, as that indicates
		 * a cloned authenticator (WebAuthn §6.1.1 step 21).
		 */
		signCount: bigint("sign_count", { mode: "bigint" }).notNull().default(sql`0`),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("security_key_user_idx").on(table.userId)]
);

// ============================================================================
// USER DEVICES — Known device registry for security alerts

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
// VERIFICATION TABLES — Email change, account deletion, sensitive actions

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
		index("email_change_code_idx").on(table.code),
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
		index("account_deletion_code_idx").on(table.code),
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
		index("sensitive_action_code_idx").on(table.code),
		// One active verification per action type per user
		uniqueIndex("sensitive_action_active_idx").on(table.userId, table.action),
	]
);
