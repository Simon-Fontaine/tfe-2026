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
import { deleteUserTotpKey, getUserTotpKey } from "@/auth/totp";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

const twoFactorDisableRoutes = new Hono<RequestContextEnv & AuthEnv>();

// POST /request — Request 2FA disable
twoFactorDisableRoutes.post("/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`2fa-disable-request:${session.userId}`,
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

	const existingKey = await getUserTotpKey(session.userId);
	if (!existingKey) return c.json({ error: "TOTP is not enabled." }, 400);

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"two_factor_disable",
		{},
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm disabling two-factor authentication",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm disabling 2FA"
				message="You requested to disable two-factor authentication on your Scrimflow account. This will make your account less secure. If you did not request this, secure your account immediately."
				actionText="enter the following verification code to confirm"
			/>
		),
	});

	return c.json({ success: true });
});

// POST /confirm — Confirm 2FA disable with code
twoFactorDisableRoutes.post("/confirm", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`2fa-disable-verify:${session.userId}`,
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
		"two_factor_disable",
		body.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const existingKey = await getUserTotpKey(session.userId);
	if (!existingKey) {
		await deleteSensitiveActionVerification(session.userId, "two_factor_disable");
		return c.json({ error: "TOTP is not enabled." }, 400);
	}

	await deleteUserTotpKey(session.userId);
	await clearRecoveryCodeIfNo2FA(session.userId);
	await deleteSensitiveActionVerification(session.userId, "two_factor_disable");

	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
		twoFactorMethod: "totp",
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

	return c.json({ success: true });
});

// DELETE /request — Cancel pending 2FA disable
twoFactorDisableRoutes.delete("/request", async (c) => {
	const session = c.get("session");
	await deleteSensitiveActionVerification(session.userId, "two_factor_disable");
	return c.json({ success: true });
});

export { twoFactorDisableRoutes };
