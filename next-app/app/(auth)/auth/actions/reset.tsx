"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import * as v from "valibot";

import { db } from "@/db";
import { passwordResetSessionTable, userTable } from "@/db/schema";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { hashPassword, verifyPasswordStrength } from "@/lib/auth/password";
import { invalidateUserSessions } from "@/lib/auth/session";
import { rateLimits } from "@/lib/config/rate-limits";
import { generateNumericCode } from "@/lib/crypto";
import { fetchGeoData } from "@/lib/geo";
import logger from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { ForgotPasswordSchema, ResetPasswordSchema } from "@/lib/validations/auth";
import { type ActionResult, extractErrors, normalizeEmail } from "./utils";

export async function forgotPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(ForgotPasswordSchema, { email: formData.get("email") });
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const email = normalizeEmail(parsed.output.email);

	const { allowed } = await checkRateLimit(
		`forgot:${email}`,
		rateLimits.forgotPassword.limit,
		rateLimits.forgotPassword.windowMs
	);
	if (!allowed) return { nextStep: "forgot-password-sent", email };

	const user = await db.query.userTable.findFirst({ where: eq(userTable.email, email) });
	if (!user) return { nextStep: "forgot-password-sent", email };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

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

	if (!resetSession) return { nextStep: "forgot-password-sent", email };

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	const resetUrl = `${appUrl}/auth?reset_token=${resetSession.id}`;

	await sendMail({
		to: email,
		subject: "Reset your Scrimflow password",
		template: <PasswordResetEmail resetUrl={resetUrl} />,
	}).catch((err: unknown) => logger.error({ err }, "password reset email send failed"));

	const geo = await fetchGeoData(client.ip);
	writeAuditLog(
		user.id,
		"password_reset_request",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city
	);

	return { nextStep: "forgot-password-sent", email };
}

export async function resetPasswordAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(ResetPasswordSchema, {
		password: formData.get("password"),
		confirmPassword: formData.get("confirmPassword"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const token = formData.get("reset_token")?.toString();
	if (!token) return { error: "Invalid reset link." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`reset:ip:${client.ip ?? "unknown"}`,
		rateLimits.resetPasswordIp.limit,
		rateLimits.resetPasswordIp.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const resetSession = await db.query.passwordResetSessionTable.findFirst({
		where: (t, { and, eq, gt }) => and(eq(t.id, token), gt(t.expiresAt, new Date())),
	});
	if (!resetSession)
		return { error: "This reset link is invalid or has expired. Please request a new one." };

	const passwordIsSafe = await verifyPasswordStrength(parsed.output.password);
	if (!passwordIsSafe) {
		return {
			fieldErrors: {
				password: [
					"This password has appeared in a known data breach. Please choose a different one.",
				],
			},
		};
	}

	const passwordHash = await hashPassword(parsed.output.password);

	await db.transaction(async (tx) => {
		await tx.update(userTable).set({ passwordHash }).where(eq(userTable.id, resetSession.userId));
		await tx.delete(passwordResetSessionTable).where(eq(passwordResetSessionTable.id, token));
	});

	await invalidateUserSessions(resetSession.userId, "password_change");

	const geo = await fetchGeoData(client.ip);
	writeAuditLog(
		resetSession.userId,
		"password_reset_complete",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city
	);

	return { nextStep: "login" };
}
