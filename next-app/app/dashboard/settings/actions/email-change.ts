"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import * as v from "valibot";

import { db } from "@/db";
import { sessionTable, userTable } from "@/db/schema";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { sendSecurityAlertEmail } from "@/lib/auth/email-security";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/lib/auth/sensitive-action";
import { getCurrentSession } from "@/lib/auth/session";
import { rateLimits } from "@/lib/config/rate-limits";
import { fetchGeoData } from "@/lib/geo";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import type { ActionResult } from "./password";

// ─── Request ─────────────────────────────────────────────────────────────────

export async function requestEmailChangeAction(newEmail: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`email-change-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const parsed = v.safeParse(
		v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("Email is required"),
			v.email("Invalid email address"),
			v.maxLength(255, "Email must be at most 255 characters")
		),
		newEmail
	);
	if (!parsed.success) return { error: "Invalid email address." };

	const normalizedEmail = parsed.output.toLowerCase();

	if (normalizedEmail === user.email.toLowerCase()) {
		return { error: "New email must be different from your current email." };
	}

	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.email, normalizedEmail))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) return { error: "This email address is already in use." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"email_change",
		{ newEmail: normalizedEmail },
		client.ip
	);

	await sendMail({
		to: normalizedEmail,
		subject: "Verify your new email address",
		template: VerificationEmail({
			code,
			title: "Verify your new email address",
			message:
				"You recently requested to change the email address on your Scrimflow account. Enter the code below to confirm the change.",
			actionText: "enter the following verification code",
		}),
	});

	return { success: true };
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifyEmailChangeAction(code: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`email-change-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const result = await validateAndConsumeSensitiveAction(session.userId, "email_change", code);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const newEmail = result.metadata?.newEmail;
	if (typeof newEmail !== "string") {
		return { error: "Verification session expired. Please start again." };
	}

	// Confirm the new email isn't taken (race condition check)
	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(and(eq(userTable.email, newEmail), ne(userTable.id, session.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) {
		await deleteSensitiveActionVerification(session.userId, "email_change");
		return { error: "This email address is no longer available." };
	}

	await db
		.update(userTable)
		.set({ email: newEmail, emailVerified: true })
		.where(eq(userTable.id, session.userId));

	// Revoke all other sessions (email change is a credential rotation event)
	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: "email_change" })
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		);

	await deleteSensitiveActionVerification(session.userId, "email_change");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	// Alert the OLD email that it was changed
	sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "email_changed",
	}).catch(() => {});

	writeAuditLog(
		session.userId,
		"email_change_complete",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ oldEmail: user.email, newEmail }
	);

	return { success: true };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelEmailChangeAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await deleteSensitiveActionVerification(session.userId, "email_change");
	return { success: true };
}
