/**
 * Centralized rate-limit configuration.
 *
 * Each entry defines the maximum number of attempts (`limit`) and the
 * sliding-window duration in milliseconds (`windowMs`) for a given action.
 *
 * Key prefixes are built at call-sites by appending a user/IP identifier,
 * e.g. `login.ip` → `login:ip:${ip}`.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────

const seconds = (n: number) => n * 1_000;
const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;

// ─── Config ────────────────────────────────────────────────────────────────────

export interface RateLimitRule {
	/** Maximum attempts within the window. */
	limit: number;
	/** Window duration in milliseconds. */
	windowMs: number;
}

export const rateLimits = {
	// ── Authentication ──────────────────────────────────────────────────────
	/** Login attempts per IP address. */
	loginIp: { limit: 10, windowMs: minutes(15) },
	/** Login attempts per email address. */
	loginEmail: { limit: 15, windowMs: minutes(15) },
	/** Account registration per IP. */
	registerIp: { limit: 5, windowMs: minutes(15) },
	/** Username availability checks. */
	usernameCheck: { limit: 20, windowMs: seconds(60) },

	// ── Password reset ──────────────────────────────────────────────────────
	/** Forgot-password requests per email. */
	forgotPassword: { limit: 3, windowMs: minutes(15) },
	/** Password reset attempts per IP. */
	resetPasswordIp: { limit: 5, windowMs: minutes(15) },
	/** Password change (authenticated). */
	changePassword: { limit: 5, windowMs: minutes(15) },

	// ── Email / device verification ─────────────────────────────────────────
	/** Email verification code attempts. */
	verifyEmail: { limit: 5, windowMs: minutes(15) },
	/** New-device verification code attempts. */
	verifyDevice: { limit: 5, windowMs: minutes(15) },
	/** Resend verification email. */
	resendVerification: { limit: 3, windowMs: minutes(15) },

	// ── Two-factor authentication ───────────────────────────────────────────
	/** TOTP code verification attempts. */
	totpAttempt: { limit: 5, windowMs: minutes(30) },
	/** TOTP setup / update operations (generate, enable, disable). */
	totpUpdate: { limit: 3, windowMs: minutes(10) },
	/** Recovery code attempts. */
	recoveryCode: { limit: 3, windowMs: hours(1) },

	// ── WebAuthn ────────────────────────────────────────────────────────────
	/** Passkey / security key 2FA verification. */
	webauthnVerify: { limit: 10, windowMs: minutes(30) },
	/** Passkey / security key registration. */
	webauthnRegister: { limit: 5, windowMs: minutes(10) },
	/** Passkey / security key deletion. */
	webauthnDelete: { limit: 5, windowMs: minutes(10) },
	/** Discoverable passkey login per IP. */
	passkeyLoginIp: { limit: 10, windowMs: minutes(15) },

	// ── Session management ──────────────────────────────────────────────────
	/** Individual session revocations. */
	sessionRevoke: { limit: 10, windowMs: minutes(15) },
	/** Bulk "revoke all other sessions". */
	sessionRevokeAll: { limit: 3, windowMs: minutes(15) },

	// ── Profile updates ──────────────────────────────────────────────────────
	/** Username change attempts. */
	changeUsername: { limit: 3, windowMs: minutes(15) },

	// ── Sensitive account actions ────────────────────────────────────────────
	/** Requesting a sensitive action verification code (email change, deletion, etc.). */
	sensitiveActionRequest: { limit: 3, windowMs: minutes(15) },
	/** Verifying a sensitive action code. */
	sensitiveActionVerify: { limit: 5, windowMs: minutes(15) },
} as const satisfies Record<string, RateLimitRule>;
