import { decodeBase64 } from "@oslojs/encoding";
import { rateLimits } from "@scrimflow/shared";
import { Hono } from "hono";
import { clearRecoveryCodeIfNo2FA } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/auth/sensitive-action";
import {
	deleteUserPasskeyCredential,
	deleteUserSecurityKeyCredential,
	getUserPasskeyCredential,
	getUserSecurityKeyCredential,
} from "@/auth/webauthn";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

const credentialRoutes = new Hono<RequestContextEnv & AuthEnv>();

credentialRoutes.post("/passkey/disable/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-disable-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req
		.json<{ credentialId: string; credentialName: string }>()
		.catch(() => null);
	if (!body?.credentialId) return c.json({ error: "Credential ID is required." }, 400);

	const credential = await getUserPasskeyCredential(
		session.userId,
		decodeBase64(body.credentialId)
	);
	if (!credential) return c.json({ error: "Passkey not found." }, 404);

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"passkey_disable",
		{ credentialId: body.credentialId, credentialName: body.credentialName || "" },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm removing your passkey",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm removing your passkey"
				message={`You requested to remove the passkey "${body.credentialName || "Unnamed"}" from your Scrimflow account. If you did not request this, secure your account immediately.`}
				actionText="enter the following verification code to confirm"
			/>
		),
	});

	return c.json({ success: true });
});

credentialRoutes.post("/passkey/disable/confirm", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-disable-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ code: string }>().catch(() => null);
	if (!body?.code) return c.json({ error: "Code is required." }, 400);

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"passkey_disable",
		body.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const { credentialId } = result.metadata as { credentialId: string; credentialName: string };
	await deleteUserPasskeyCredential(session.userId, decodeBase64(credentialId));
	await clearRecoveryCodeIfNo2FA(session.userId);
	await deleteSensitiveActionVerification(session.userId, "passkey_disable");

	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "passkey",
	});

	writeAuditLog(
		session.userId,
		"passkey_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialId,
			method: "email_verified",
		}
	);

	return c.json({ success: true });
});

credentialRoutes.delete("/passkey/disable/request", async (c) => {
	const session = c.get("session");
	await deleteSensitiveActionVerification(session.userId, "passkey_disable");
	return c.json({ success: true });
});

credentialRoutes.post("/security-key/disable/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`security-key-disable-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req
		.json<{ credentialId: string; credentialName: string }>()
		.catch(() => null);
	if (!body?.credentialId) return c.json({ error: "Credential ID is required." }, 400);

	const credential = await getUserSecurityKeyCredential(
		session.userId,
		decodeBase64(body.credentialId)
	);
	if (!credential) return c.json({ error: "Security key not found." }, 404);

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"security_key_disable",
		{ credentialId: body.credentialId, credentialName: body.credentialName || "" },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm removing your security key",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm removing your security key"
				message={`You requested to remove the security key "${body.credentialName || "Unnamed"}" from your Scrimflow account. If you did not request this, secure your account immediately.`}
				actionText="enter the following verification code to confirm"
			/>
		),
	});

	return c.json({ success: true });
});

credentialRoutes.post("/security-key/disable/confirm", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`security-key-disable-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ code: string }>().catch(() => null);
	if (!body?.code) return c.json({ error: "Code is required." }, 400);

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"security_key_disable",
		body.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const { credentialId } = result.metadata as { credentialId: string; credentialName: string };
	await deleteUserSecurityKeyCredential(session.userId, decodeBase64(credentialId));
	await clearRecoveryCodeIfNo2FA(session.userId);
	await deleteSensitiveActionVerification(session.userId, "security_key_disable");

	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "security_key",
	});

	writeAuditLog(
		session.userId,
		"security_key_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialId,
			method: "email_verified",
		}
	);

	return c.json({ success: true });
});

credentialRoutes.delete("/security-key/disable/request", async (c) => {
	const session = c.get("session");
	await deleteSensitiveActionVerification(session.userId, "security_key_disable");
	return c.json({ success: true });
});

export { credentialRoutes };
