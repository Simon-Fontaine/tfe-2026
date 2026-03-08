import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
	passkeyCredentialTable,
	securityKeyCredentialTable,
	sessionTable,
	totpCredentialTable,
	userTable,
} from "@/db/schema";
import { rateLimits } from "@/lib/config/rate-limits";
import { timingSafeCompare } from "@/lib/crypto";
import { decryptTextToString, encryptStringToText } from "@/lib/encryption";
import { checkRateLimit, type RateLimitResult, resetRateLimit } from "@/lib/rate-limit";

// ─── Rate limiters ─────────────────────────────────────────────────────────────

/** Validates recovery code attempt rate limit. */
export function checkRecoveryCodeRateLimit(userId: string): Promise<RateLimitResult> {
	return checkRateLimit(
		`recovery:${userId}`,
		rateLimits.recoveryCode.limit,
		rateLimits.recoveryCode.windowMs
	);
}

export function resetRecoveryCodeRateLimit(userId: string): Promise<void> {
	return resetRateLimit(`recovery:${userId}`);
}

// ─── Recovery code helpers ─────────────────────────────────────────────────────

/** Generates cryptographically random base32 recovery code. */
export function generateRecoveryCode(): string {
	const bytes = new Uint8Array(10);
	crypto.getRandomValues(bytes);
	return encodeBase32UpperCaseNoPadding(bytes);
}

/** Clears the user's recovery code if they have no 2FA methods enabled. */
export async function clearRecoveryCodeIfNo2FA(userId: string): Promise<void> {
	const status = await getUserTwoFactorStatus(userId);
	if (!status.registered2FA) {
		await db.update(userTable).set({ recoveryCode: null }).where(eq(userTable.id, userId));
	}
}

// ─── 2FA reset ─────────────────────────────────────────────────────────────────

/** Validates recovery code, resets 2FA credentials, and rotates code. */
export async function resetUser2faWithRecoveryCode(
	userId: string,
	recoveryCode: string
): Promise<boolean> {
	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	const currentEncryptedCode = user?.recoveryCode;
	if (!currentEncryptedCode) return false;

	const storedCode = decryptTextToString(currentEncryptedCode);
	const normalizedInput = recoveryCode.replace(/-/g, "").toUpperCase();
	if (!timingSafeCompare(normalizedInput, storedCode)) return false;

	const newEncryptedCode = encryptStringToText(generateRecoveryCode());

	return db.transaction(async (tx) => {
		// Compare-and-swap concurrent requests
		const updated = await tx
			.update(userTable)
			.set({ recoveryCode: newEncryptedCode })
			.where(and(eq(userTable.id, userId), eq(userTable.recoveryCode, currentEncryptedCode)))
			.returning({ id: userTable.id });

		if (updated.length === 0) return false;

		await Promise.all([
			tx
				.update(sessionTable)
				.set({ twoFactorVerified: false })
				.where(and(eq(sessionTable.userId, userId), isNull(sessionTable.revokedAt))),
			tx.delete(totpCredentialTable).where(eq(totpCredentialTable.userId, userId)),
			tx.delete(passkeyCredentialTable).where(eq(passkeyCredentialTable.userId, userId)),
			tx.delete(securityKeyCredentialTable).where(eq(securityKeyCredentialTable.userId, userId)),
		]);

		return true;
	});
}

// ─── 2FA detection ─────────────────────────────────────────────────────────────

export interface TwoFactorStatus {
	registeredTOTP: boolean;
	registeredPasskey: boolean;
	registeredSecurityKey: boolean;
	registered2FA: boolean;
}

/** Returns 2FA registration status. */
export async function getUserTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
	const [totpRows, passkeyRows, securityKeyRows] = await Promise.all([
		db
			.select({ id: totpCredentialTable.id })
			.from(totpCredentialTable)
			.where(eq(totpCredentialTable.userId, userId))
			.limit(1),
		db
			.select({ id: passkeyCredentialTable.id })
			.from(passkeyCredentialTable)
			.where(eq(passkeyCredentialTable.userId, userId))
			.limit(1),
		db
			.select({ id: securityKeyCredentialTable.id })
			.from(securityKeyCredentialTable)
			.where(eq(securityKeyCredentialTable.userId, userId))
			.limit(1),
	]);

	const registeredTOTP = totpRows.length > 0;
	const registeredPasskey = passkeyRows.length > 0;
	const registeredSecurityKey = securityKeyRows.length > 0;

	return {
		registeredTOTP,
		registeredPasskey,
		registeredSecurityKey,
		registered2FA: registeredTOTP || registeredPasskey || registeredSecurityKey,
	};
}
