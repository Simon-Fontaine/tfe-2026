import { ForgotPasswordSchema, ResetPasswordSchema, rateLimits } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
import { hashPassword, verifyPasswordStrength } from "@/auth/password";
import { invalidateUserSessions } from "@/auth/session";
import { generateNumericCode } from "@/crypto/utils";
import { db } from "@/db";
import { passwordResetSessionTable, userTable } from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { PasswordResetEmail } from "@/email/templates/PasswordResetEmail";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { disconnectChatUserSessions } from "@/realtime/chat-hub";
import { disconnectRealtimeUserSessions } from "@/realtime/scrim-hub";
import { fetchGeoData } from "@/utils/geo";
import logger from "@/utils/logger";

import { type ActionResult, extractErrors, normalizeEmail } from "./utils";

const resetRoutes = new Hono<RequestContextEnv>();

resetRoutes.post("/forgot-password", async (c) => {
	const body = await c.req.json<{ email?: string }>();

	const parsed = v.safeParse(ForgotPasswordSchema, { email: body.email });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const email = normalizeEmail(parsed.output.email);

	const { allowed } = await checkRateLimit(
		`forgot:${email}`,
		rateLimits.forgotPassword.limit,
		rateLimits.forgotPassword.windowMs
	);
	if (!allowed) return c.json({ nextStep: "forgot-password-sent", email } satisfies ActionResult);

	const user = await db.query.userTable.findFirst({ where: eq(userTable.email, email) });
	if (!user) return c.json({ nextStep: "forgot-password-sent", email } satisfies ActionResult);

	const client = c.get("client");

	await db.delete(passwordResetSessionTable).where(eq(passwordResetSessionTable.userId, user.id));

	const [resetSession] = await db
		.insert(passwordResetSessionTable)
		.values({
			userId: user.id,
			email,
			code: generateNumericCode(6),
			expiresAt: new Date(Date.now() + 1_000 * 60 * 60),
			ipAddress: client.ip,
			userAgent: client.userAgent,
		})
		.returning({ id: passwordResetSessionTable.id });

	if (!resetSession)
		return c.json({ nextStep: "forgot-password-sent", email } satisfies ActionResult);

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	const resetUrl = `${appUrl}/auth?reset_token=${resetSession.id}`;

	try {
		await sendMail({
			to: email,
			subject: "Reset your Scrimflow password",
			template: <PasswordResetEmail resetUrl={resetUrl} />,
		});
	} catch (err) {
		logger.error({ err }, "password reset email send failed");
		await db
			.delete(passwordResetSessionTable)
			.where(eq(passwordResetSessionTable.id, resetSession.id))
			.catch((deleteErr: unknown) =>
				logger.error(
					{ err: deleteErr, resetSessionId: resetSession.id },
					"failed to roll back password reset session after email failure"
				)
			);
		// Return the same constant response as every other branch so an email
		// outage can't be used to enumerate which addresses have accounts.
		return c.json({ nextStep: "forgot-password-sent", email } satisfies ActionResult);
	}

	const geo = await fetchGeoData(client.ip);
	writeAuditLog(
		user.id,
		"password_reset_request",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city
	);

	return c.json({ nextStep: "forgot-password-sent", email } satisfies ActionResult);
});

resetRoutes.post("/reset-password", async (c) => {
	const body = await c.req.json<{
		password?: string;
		confirmPassword?: string;
		reset_token?: string;
	}>();

	const parsed = v.safeParse(ResetPasswordSchema, {
		password: body.password,
		confirmPassword: body.confirmPassword,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const token = body.reset_token;
	if (!token) return c.json({ error: "Invalid reset link." } satisfies ActionResult, 400);

	const client = c.get("client");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`reset:ip:${client.ip ?? "unknown"}`,
		rateLimits.resetPasswordIp.limit,
		rateLimits.resetPasswordIp.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);
	}

	const resetSession = await db.query.passwordResetSessionTable.findFirst({
		where: (t, { and, eq, gt }) => and(eq(t.id, token), gt(t.expiresAt, new Date())),
	});
	if (!resetSession)
		return c.json(
			{
				error: "This reset link is invalid or has expired. Please request a new one.",
			} satisfies ActionResult,
			400
		);

	const passwordIsSafe = await verifyPasswordStrength(parsed.output.password);
	if (!passwordIsSafe) {
		return c.json(
			{
				fieldErrors: {
					password: [
						"This password has appeared in a known data breach. Please choose a different one.",
					],
				},
			} satisfies ActionResult,
			400
		);
	}

	const passwordHash = await hashPassword(parsed.output.password);

	await db.transaction(async (tx) => {
		await tx.update(userTable).set({ passwordHash }).where(eq(userTable.id, resetSession.userId));
		await tx.delete(passwordResetSessionTable).where(eq(passwordResetSessionTable.id, token));
	});

	await invalidateUserSessions(resetSession.userId, "password_change");
	disconnectRealtimeUserSessions(resetSession.userId, "session_revoked");
	disconnectChatUserSessions(resetSession.userId, "session_revoked");

	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: resetSession.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "password_changed",
	});

	writeAuditLog(
		resetSession.userId,
		"password_reset_complete",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city
	);

	return c.json({ nextStep: "login" } satisfies ActionResult);
});

export { resetRoutes };
