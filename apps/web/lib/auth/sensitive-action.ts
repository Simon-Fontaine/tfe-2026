import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sensitiveActionVerificationTable } from "@/db/schema";
import { generateNumericCode, timingSafeCompare } from "@/lib/crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationAction = (typeof sensitiveActionVerificationTable.$inferInsert)["action"];

export interface VerificationResult {
	success: true;
	metadata: Record<string, unknown> | null;
}

export interface VerificationFailure {
	success: false;
}

const EXPIRY_MS = 1_000 * 60 * 15; // 15 minutes

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Creates (or replaces) a sensitive action verification record.
 * Returns the 6-digit code to send to the user.
 * One record per user+action — any previous pending code is invalidated.
 */
export async function createSensitiveActionVerification(
	userId: string,
	action: VerificationAction,
	metadata?: Record<string, unknown>,
	ipAddress?: string | null
): Promise<string> {
	const code = generateNumericCode(6);
	const expiresAt = new Date(Date.now() + EXPIRY_MS);

	// Delete any existing pending verification for this user+action before inserting
	await db
		.delete(sensitiveActionVerificationTable)
		.where(
			and(
				eq(sensitiveActionVerificationTable.userId, userId),
				eq(sensitiveActionVerificationTable.action, action)
			)
		);

	await db.insert(sensitiveActionVerificationTable).values({
		userId,
		action,
		code,
		metadata: metadata ?? null,
		ipAddress: ipAddress ?? null,
		expiresAt,
	});

	return code;
}

// ─── Validate & consume ───────────────────────────────────────────────────────

/**
 * Verifies the code against the active pending record.
 * On success, marks the record as verified and returns its metadata.
 * The record is NOT deleted — call `deleteSensitiveActionVerification` after
 * the underlying sensitive action completes.
 */
export async function validateAndConsumeSensitiveAction(
	userId: string,
	action: VerificationAction,
	code: string
): Promise<VerificationResult | VerificationFailure> {
	const rows = await db
		.select()
		.from(sensitiveActionVerificationTable)
		.where(
			and(
				eq(sensitiveActionVerificationTable.userId, userId),
				eq(sensitiveActionVerificationTable.action, action),
				gt(sensitiveActionVerificationTable.expiresAt, new Date()),
				isNull(sensitiveActionVerificationTable.verifiedAt)
			)
		)
		.limit(1);

	const record = rows[0] ?? null;
	if (!record) return { success: false };

	if (!timingSafeCompare(code, record.code)) return { success: false };

	await db
		.update(sensitiveActionVerificationTable)
		.set({ verifiedAt: new Date() })
		.where(eq(sensitiveActionVerificationTable.id, record.id));

	return { success: true, metadata: record.metadata ?? null };
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/** Deletes all verification records for a user+action. */
export async function deleteSensitiveActionVerification(
	userId: string,
	action: VerificationAction
): Promise<void> {
	await db
		.delete(sensitiveActionVerificationTable)
		.where(
			and(
				eq(sensitiveActionVerificationTable.userId, userId),
				eq(sensitiveActionVerificationTable.action, action)
			)
		);
}
