"use server";

import { decodeBase64 } from "@oslojs/encoding";
import { headers } from "next/headers";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { clearRecoveryCodeIfNo2FA } from "@/lib/auth/2fa";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { sendSecurityAlertEmail } from "@/lib/auth/email-security";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/lib/auth/sensitive-action";
import { getCurrentSession } from "@/lib/auth/session";
import {
	deleteUserPasskeyCredential,
	deleteUserSecurityKeyCredential,
	getUserPasskeyCredential,
	getUserSecurityKeyCredential,
} from "@/lib/auth/webauthn";
import { rateLimits } from "@/lib/config/rate-limits";
import { fetchGeoData } from "@/lib/geo";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import type { ActionResult } from "./password";

// ─── Passkey disable ───────────────────────────────────────────────────────────

export async function requestPasskeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-disable-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	// Verify ownership before sending the email
	const credential = await getUserPasskeyCredential(session.userId, decodeBase64(credentialId));
	if (!credential) return { error: "Passkey not found." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"passkey_disable",
		{ credentialId, credentialName },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm removing your passkey",
		template: VerificationEmail({
			code,
			title: "Confirm removing your passkey",
			message: `You requested to remove the passkey "${credentialName}" from your Scrimflow account. If you did not request this, secure your account immediately.`,
			actionText: "enter the following verification code to confirm",
		}),
	});

	return { success: true };
}

export async function confirmPasskeyDisableAction(code: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-disable-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const result = await validateAndConsumeSensitiveAction(session.userId, "passkey_disable", code);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const { credentialId } = result.metadata as { credentialId: string; credentialName: string };

	await deleteUserPasskeyCredential(session.userId, decodeBase64(credentialId));
	await clearRecoveryCodeIfNo2FA(session.userId);
	await deleteSensitiveActionVerification(session.userId, "passkey_disable");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "passkey",
	}).catch(() => {});

	writeAuditLog(
		session.userId,
		"passkey_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ credentialId, method: "email_verified" }
	);

	return { success: true };
}

export async function cancelPasskeyDisableAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await deleteSensitiveActionVerification(session.userId, "passkey_disable");
	return { success: true };
}

// ─── Security key disable ──────────────────────────────────────────────────────

export async function requestSecurityKeyDisableAction(
	credentialId: string,
	credentialName: string
): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`security-key-disable-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	// Verify ownership before sending the email
	const credential = await getUserSecurityKeyCredential(session.userId, decodeBase64(credentialId));
	if (!credential) return { error: "Security key not found." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createSensitiveActionVerification(
		session.userId,
		"security_key_disable",
		{ credentialId, credentialName },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm removing your security key",
		template: VerificationEmail({
			code,
			title: "Confirm removing your security key",
			message: `You requested to remove the security key "${credentialName}" from your Scrimflow account. If you did not request this, secure your account immediately.`,
			actionText: "enter the following verification code to confirm",
		}),
	});

	return { success: true };
}

export async function confirmSecurityKeyDisableAction(code: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`security-key-disable-verify:${session.userId}`,
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
		"security_key_disable",
		code
	);
	if (!result.success) return { error: "Invalid or expired verification code." };

	const { credentialId } = result.metadata as { credentialId: string; credentialName: string };

	await deleteUserSecurityKeyCredential(session.userId, decodeBase64(credentialId));
	await clearRecoveryCodeIfNo2FA(session.userId);
	await deleteSensitiveActionVerification(session.userId, "security_key_disable");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "security_key",
	}).catch(() => {});

	writeAuditLog(
		session.userId,
		"security_key_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ credentialId, method: "email_verified" }
	);

	return { success: true };
}

export async function cancelSecurityKeyDisableAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await deleteSensitiveActionVerification(session.userId, "security_key_disable");
	return { success: true };
}
