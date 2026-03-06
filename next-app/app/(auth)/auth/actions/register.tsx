"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { createEmailVerificationRequest } from "@/lib/auth/email-verification";
import { hashPassword, verifyPasswordStrength } from "@/lib/auth/password";
import { setPendingAuthCookie } from "@/lib/auth/pending-auth";
import { rateLimits } from "@/lib/config/rate-limits";
import logger from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { RegisterSchema } from "@/lib/validations/auth";
import { type ActionResult, extractErrors, normalizeEmail } from "./utils";

export async function registerAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(RegisterSchema, {
		email: formData.get("email"),
		username: formData.get("username"),
		displayName: formData.get("displayName") || undefined,
		password: formData.get("password"),
		confirmPassword: formData.get("confirmPassword"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`register:ip:${client.ip ?? "unknown"}`,
		rateLimits.registerIp.limit,
		rateLimits.registerIp.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many registration attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const email = normalizeEmail(parsed.output.email);
	const { username, displayName, password } = parsed.output;

	const [existingEmail, existingUsername] = await Promise.all([
		db.query.userTable.findFirst({ where: eq(userTable.email, email) }),
		db.query.userTable.findFirst({ where: eq(userTable.username, username) }),
	]);

	if (existingEmail) return { fieldErrors: { email: ["This email is already registered."] } };
	if (existingUsername) return { fieldErrors: { username: ["This username is already taken."] } };

	const passwordIsSafe = await verifyPasswordStrength(password);
	if (!passwordIsSafe) {
		return {
			fieldErrors: {
				password: [
					"This password has appeared in a known data breach. Please choose a different one.",
				],
			},
		};
	}

	const passwordHash = await hashPassword(password);

	const [newUser] = await db
		.insert(userTable)
		.values({ email, username, displayName: displayName ?? username, passwordHash })
		.returning({ id: userTable.id, email: userTable.email });

	if (!newUser) return { error: "Registration failed. Please try again." };

	const code = await createEmailVerificationRequest(newUser.id, newUser.email, client.ip);
	await sendMail({
		to: newUser.email,
		subject: "Verify your Scrimflow account",
		template: (
			<VerificationEmail
				code={code}
				title="Verify your email address"
				message="Welcome to Scrimflow! Please verify your email address to complete your registration."
				actionText="enter the following code"
			/>
		),
	}).catch((err: unknown) => logger.error({ err }, "registration email send failed"));

	writeAuditLog(newUser.id, "signup", client.ip, client.userAgent, null, null);
	await setPendingAuthCookie(newUser.id);

	return { nextStep: "verify-email", email: newUser.email };
}

export async function checkUsernameAction(username: string): Promise<{ available: boolean }> {
	const trimmed = username.trim();

	const { allowed } = await checkRateLimit(
		`username-check:${trimmed}`,
		rateLimits.usernameCheck.limit,
		rateLimits.usernameCheck.windowMs
	);
	if (!allowed) return { available: false };

	const existing = await db.query.userTable.findFirst({
		where: eq(userTable.username, trimmed),
		columns: { id: true },
	});
	return { available: !existing };
}
