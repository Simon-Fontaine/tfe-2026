"use server";

import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import * as v from "valibot";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { sendSecurityAlertEmail } from "@/lib/auth/email-security";
import { getCurrentSession } from "@/lib/auth/session";
import {
	checkTotpUpdateRateLimit,
	deleteUserTotpKey,
	getUserTotpKey,
	upsertUserTotpKey,
} from "@/lib/auth/totp";
import { encryptStringToText } from "@/lib/encryption";
import { fetchGeoData } from "@/lib/geo";
import { formatRetryAfter } from "@/lib/rate-limit";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TotpSetupResult {
	error?: string;
	success?: boolean;
}

interface TotpSecretResult {
	error?: string;
	/** Base32-encoded TOTP secret for display / QR code. */
	secret?: string;
	/** otpauth:// URI for authenticator apps. */
	uri?: string;
}

// ─── Validation ────────────────────────────────────────────────────────────────

const TotpCodeSchema = v.pipe(
	v.string(),
	v.trim(),
	v.length(6, "Code must be exactly 6 digits"),
	v.regex(/^\d{6}$/, "Code must contain only digits")
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a random base32 recovery code. */
function generateRecoveryCode(): string {
	const bytes = new Uint8Array(10);
	crypto.getRandomValues(bytes);
	return encodeBase32UpperCaseNoPadding(bytes);
}

/** Ensures the user has a recovery code. Creates one if missing. */
async function ensureRecoveryCode(userId: string): Promise<string | null> {
	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (user?.recoveryCode) return null;

	const code = generateRecoveryCode();
	const encrypted = encryptStringToText(code);
	await db.update(userTable).set({ recoveryCode: encrypted }).where(eq(userTable.id, userId));
	return code;
}

// ─── Generate TOTP Secret ──────────────────────────────────────────────────────

/**
 * Generates a new TOTP secret for the user.
 * Secret must be verified and persisted via verifyAndEnableTotpAction.
 */
export async function generateTotpSecretAction(): Promise<TotpSetupResult & TotpSecretResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: 3 TOTP setup attempts per 10 minutes
	const { allowed, retryAfterMs } = await checkTotpUpdateRateLimit(session.userId);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	// Generate a 20-byte random secret (160 bits, standard for TOTP)
	const secretBytes = new Uint8Array(20);
	crypto.getRandomValues(secretBytes);
	const secret = encodeBase32UpperCaseNoPadding(secretBytes);

	// Build otpauth:// URI (RFC 6238 + Google Authenticator convention)
	const issuer = encodeURIComponent("Scrimflow");
	const account = encodeURIComponent(user.email);
	const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

	return { secret, uri };
}

// ─── Verify & Enable TOTP ────────────────────────────────────────────────────

/**
 * Verifies a TOTP code against the provided secret, and if valid,
 * persists the TOTP credential for the user to complete 2FA enrollment.
 */
export async function verifyAndEnableTotpAction(
	secret: string,
	code: string
): Promise<TotpSetupResult & { recoveryCode?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit
	const { allowed, retryAfterMs } = await checkTotpUpdateRateLimit(session.userId);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	// Validate code format
	const parsed = v.safeParse(TotpCodeSchema, code);
	if (!parsed.success) return { error: "Invalid code format." };

	// Decode the base32 secret back to bytes
	const { decodeBase32 } = await import("@oslojs/encoding");
	let keyBytes: Uint8Array;
	try {
		keyBytes = decodeBase32(secret);
	} catch {
		return { error: "Invalid secret." };
	}

	// Verify the TOTP code against the secret
	const { generateHOTP } = await import("@oslojs/otp");
	const now = BigInt(Math.floor(Date.now() / 1000));
	const period = BigInt(30);
	const currentWindow = now / period;

	// Allow ±1 window (~30s drift) for initial setup
	let valid = false;
	for (const offset of [BigInt(-1), BigInt(0), BigInt(1)]) {
		if (generateHOTP(keyBytes, currentWindow + offset, 6) === parsed.output) {
			valid = true;
			break;
		}
	}

	if (!valid) {
		return { error: "Invalid code. Make sure your authenticator app is showing the correct code." };
	}

	// Persist the TOTP key
	await upsertUserTotpKey(session.userId, keyBytes);

	// Ensure recovery code exists (first 2FA credential)
	const recoveryCode = await ensureRecoveryCode(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
	});

	writeAuditLog(
		session.userId,
		"two_factor_enable",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			method: "totp",
		}
	);

	return { success: true, ...(recoveryCode ? { recoveryCode } : {}) };
}

// ─── Disable TOTP ────────────────────────────────────────────────────────────

/** Removes the user's TOTP credential. */
export async function disableTotpAction(): Promise<TotpSetupResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: 5 disable attempts per 15 minutes
	const { allowed, retryAfterMs } = await checkTotpUpdateRateLimit(session.userId);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	// Check if the user actually has TOTP enabled
	const existingKey = await getUserTotpKey(session.userId);
	if (!existingKey) return { error: "TOTP is not enabled." };

	await deleteUserTotpKey(session.userId);
	const { clearRecoveryCodeIfNo2FA } = await import("@/lib/auth/2fa");
	await clearRecoveryCodeIfNo2FA(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
	});

	writeAuditLog(
		session.userId,
		"two_factor_disable",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			method: "totp",
		}
	);

	return { success: true };
}

// ─── Status ────────────────────────────────────────────────────────────────────

/** Returns whether TOTP is currently enabled for the authenticated user. */
export async function getTotpStatusAction(): Promise<{ enabled: boolean }> {
	const { session } = await getCurrentSession();
	if (!session) return { enabled: false };

	const key = await getUserTotpKey(session.userId);
	return { enabled: key !== null };
}
