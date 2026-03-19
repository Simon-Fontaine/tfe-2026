"use server";

import { headers } from "next/headers";
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
import { deleteUserTotpKey, getUserTotpKey } from "@/lib/auth/totp";
import { rateLimits } from "@/lib/config/rate-limits";
import { fetchGeoData } from "@/lib/geo";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import type { ActionResult } from "./password";

// ─── Step 1: request confirmation code ───────────────────────────────────────

export async function requestTwoFactorDisableAction(): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`2fa-disable-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const existingKey = await getUserTotpKey(session.userId);
	if (!existingKey) return { error: "TOTP is not enabled." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"two_factor_disable",
		{},
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm disabling two-factor authentication",
		template: VerificationEmail({
			code,
			title: "Confirm disabling 2FA",
			message:
				"You requested to disable two-factor authentication on your Scrimflow account. This will make your account less secure. If you did not request this, secure your account immediately.",
			actionText: "enter the following verification code to confirm",
		}),
	});

	return { success: true };
}

// ─── Step 2: verify code, disable TOTP ───────────────────────────────────────

export async function confirmTwoFactorDisableAction(code: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`2fa-disable-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"two_factor_disable",
		code
	);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const existingKey = await getUserTotpKey(session.userId);
	if (!existingKey) {
		await deleteSensitiveActionVerification(session.userId, "two_factor_disable");
		return { error: "TOTP is not enabled." };
	}

	await deleteUserTotpKey(session.userId);

	const { clearRecoveryCodeIfNo2FA } = await import("@/lib/auth/2fa");
	await clearRecoveryCodeIfNo2FA(session.userId);

	await deleteSensitiveActionVerification(session.userId, "two_factor_disable");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "totp",
	}).catch(() => {});

	writeAuditLog(
		session.userId,
		"two_factor_disable",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ method: "totp" }
	);

	return { success: true };
}

// ─── Cancel pending disable ───────────────────────────────────────────────────

export async function cancelTwoFactorDisableAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await deleteSensitiveActionVerification(session.userId, "two_factor_disable");
	return { success: true };
}
