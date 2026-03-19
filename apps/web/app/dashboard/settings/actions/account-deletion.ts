"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { accountDeletionRequestTable } from "@/db/schema";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/lib/auth/sensitive-action";
import { getCurrentSession } from "@/lib/auth/session";
import { rateLimits } from "@/lib/config/rate-limits";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import type { ActionResult } from "./password";

// Grace period before permanent deletion
const DELETION_GRACE_PERIOD_MS = 1_000 * 60 * 60 * 24 * 30; // 30 days

export interface DeletionStatus {
	isPending: boolean;
	scheduledAt: string | null;
}

// ─── Status check ────────────────────────────────────────────────────────────

export async function getAccountDeletionStatusAction(): Promise<DeletionStatus> {
	const { session } = await getCurrentSession();
	if (!session) return { isPending: false, scheduledAt: null };

	const record = await db
		.select({ scheduledDeletionAt: accountDeletionRequestTable.scheduledDeletionAt })
		.from(accountDeletionRequestTable)
		.where(
			and(
				eq(accountDeletionRequestTable.userId, session.userId),
				isNull(accountDeletionRequestTable.cancelledAt)
			)
		)
		.orderBy(accountDeletionRequestTable.createdAt)
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!record?.scheduledDeletionAt) return { isPending: false, scheduledAt: null };

	return {
		isPending: true,
		scheduledAt: record.scheduledDeletionAt.toISOString(),
	};
}

// ─── Request ─────────────────────────────────────────────────────────────────

export async function requestAccountDeletionAction(reason?: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`account-deletion-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"account_deletion",
		{ reason: reason ?? null },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm account deletion",
		template: VerificationEmail({
			code,
			title: "Confirm your account deletion",
			message:
				"You requested to permanently delete your Scrimflow account. This action cannot be undone. If you did not request this, you can safely ignore this email.",
			actionText: "enter the following confirmation code",
		}),
	});

	writeAuditLog(
		session.userId,
		"account_deletion_request",
		client.ip,
		client.userAgent,
		null,
		null,
		{ reason: reason ?? null }
	);

	return { success: true };
}

// ─── Confirm ─────────────────────────────────────────────────────────────────

export async function confirmAccountDeletionAction(code: string): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`account-deletion-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const result = await validateAndConsumeSensitiveAction(session.userId, "account_deletion", code);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const reason = typeof result.metadata?.reason === "string" ? result.metadata.reason : null;

	const scheduledDeletionAt = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);

	await db.insert(accountDeletionRequestTable).values({
		userId: session.userId,
		code,
		reason,
		// expiresAt reflects when the code itself expired — it's already consumed at this point
		expiresAt: new Date(),
		confirmedAt: new Date(),
		scheduledDeletionAt,
		ipAddress: null,
	});

	await deleteSensitiveActionVerification(session.userId, "account_deletion");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	writeAuditLog(
		session.userId,
		"account_deletion_confirm",
		client.ip,
		client.userAgent,
		null,
		null,
		{ scheduledDeletionAt: scheduledDeletionAt.toISOString() }
	);

	// Session stays alive — client redirects to /deletion-pending
	return { success: true };
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelAccountDeletionAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	const updated = await db
		.update(accountDeletionRequestTable)
		.set({ cancelledAt: new Date() })
		.where(
			and(
				eq(accountDeletionRequestTable.userId, session.userId),
				isNull(accountDeletionRequestTable.cancelledAt),
				gt(accountDeletionRequestTable.scheduledDeletionAt, new Date())
			)
		)
		.returning({ id: accountDeletionRequestTable.id });

	if (updated.length === 0) return { error: "No pending deletion request found." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	writeAuditLog(
		session.userId,
		"account_deletion_cancel",
		client.ip,
		client.userAgent,
		null,
		null,
		undefined
	);

	return { success: true };
}
