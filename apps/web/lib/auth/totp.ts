import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { totpCredentialTable } from "@/db/schema";
import { rateLimits } from "@/lib/config/rate-limits";
import { decryptFromText, encryptToText } from "@/lib/encryption";
import { checkRateLimit, type RateLimitResult, resetRateLimit } from "@/lib/rate-limit";

// ─── Rate limiters ─────────────────────────────────────────────────────────────

/** Validates TOTP attempt rate limit. */
export function checkTotpRateLimit(userId: string): Promise<RateLimitResult> {
	return checkRateLimit(
		`totp:${userId}`,
		rateLimits.totpAttempt.limit,
		rateLimits.totpAttempt.windowMs
	);
}

export function resetTotpRateLimit(userId: string): Promise<void> {
	return resetRateLimit(`totp:${userId}`);
}

/** Validates TOTP update rate limit. */
export function checkTotpUpdateRateLimit(userId: string): Promise<RateLimitResult> {
	return checkRateLimit(
		`totp:update:${userId}`,
		rateLimits.totpUpdate.limit,
		rateLimits.totpUpdate.windowMs
	);
}

// ─── TOTP credential operations ────────────────────────────────────────────────

/** Returns user's decrypted TOTP secret key. */
export async function getUserTotpKey(userId: string): Promise<Uint8Array | null> {
	const row = await db
		.select({ key: totpCredentialTable.key })
		.from(totpCredentialTable)
		.where(eq(totpCredentialTable.userId, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!row) return null;

	return decryptFromText(row.key);
}

/** Upserts TOTP key and resets counter. */
export async function upsertUserTotpKey(userId: string, key: Uint8Array): Promise<void> {
	const encryptedKey = encryptToText(key);

	await db
		.insert(totpCredentialTable)
		.values({ userId, key: encryptedKey })
		.onConflictDoUpdate({
			target: totpCredentialTable.userId,
			set: { key: encryptedKey, lastUsedCounter: null },
		});
}

/** Atomically accepts strictly newer TOTP counter (replay prevention). */
export async function checkAndUpdateTotpCounter(userId: string, counter: bigint): Promise<boolean> {
	const updated = await db
		.update(totpCredentialTable)
		.set({ lastUsedCounter: counter })
		.where(
			and(
				eq(totpCredentialTable.userId, userId),
				// Enforce strictly monotonic counter
				or(
					isNull(totpCredentialTable.lastUsedCounter),
					lt(totpCredentialTable.lastUsedCounter, counter)
				)
			)
		)
		.returning({ id: totpCredentialTable.id });

	return updated.length > 0;
}

export async function deleteUserTotpKey(userId: string): Promise<void> {
	await db.delete(totpCredentialTable).where(eq(totpCredentialTable.userId, userId));
}
