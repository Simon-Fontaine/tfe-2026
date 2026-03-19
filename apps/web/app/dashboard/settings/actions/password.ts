"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { sessionTable, userTable } from "@/db/schema";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { sendSecurityAlertEmail } from "@/lib/auth/email-security";
import { hashPassword, verifyPasswordHash } from "@/lib/auth/password";
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

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function requestPasswordChangeAction(currentPassword: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-password:${session.userId}`,
		rateLimits.changePassword.limit,
		rateLimits.changePassword.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const userRow = await db
		.select({ passwordHash: userTable.passwordHash })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!userRow?.passwordHash) {
		return {
			error:
				"Your account uses passkey-only login and has no password set. You can set a password from the password reset flow.",
		};
	}

	const isValid = await verifyPasswordHash(userRow.passwordHash, currentPassword);
	if (!isValid) return { error: "Current password is incorrect." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"password_change",
		{},
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm your password change",
		template: VerificationEmail({
			code,
			title: "Confirm your password change",
			message:
				"You requested to change the password on your Scrimflow account. Enter the code below to confirm.",
			actionText: "enter the following verification code",
		}),
	});

	return { success: true };
}

export async function confirmPasswordChangeAction(
	code: string,
	newPassword: string
): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-password-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const result = await validateAndConsumeSensitiveAction(session.userId, "password_change", code);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const newHash = await hashPassword(newPassword);
	await db.update(userTable).set({ passwordHash: newHash }).where(eq(userTable.id, session.userId));

	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: "password_change" })
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		);

	await deleteSensitiveActionVerification(session.userId, "password_change");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "password_changed",
	}).catch(() => {});

	writeAuditLog(
		session.userId,
		"password_change",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		undefined
	);

	return { success: true };
}

export async function cancelPasswordChangeAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await deleteSensitiveActionVerification(session.userId, "password_change");
	return { success: true };
}
