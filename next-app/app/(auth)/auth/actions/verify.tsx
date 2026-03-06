"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { extractClientContext } from "@/lib/auth/device";
import {
	createEmailVerificationRequest,
	deleteVerificationRequests,
	getActiveVerificationRequest,
} from "@/lib/auth/email-verification";
import { deletePendingAuthCookie, getPendingAuthUserId } from "@/lib/auth/pending-auth";
import { rateLimits } from "@/lib/config/rate-limits";
import { timingSafeCompare } from "@/lib/crypto";
import logger from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { VerifyCodeSchema } from "@/lib/validations/auth";
import { type ActionResult, extractErrors, resolveAndCreateSession } from "./utils";

export async function verifyEmailAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(VerifyCodeSchema, { code: formData.get("code") });
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const userId = await getPendingAuthUserId();
	if (!userId) return { error: "Session expired. Please start over." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`verify-email:${userId}`,
		rateLimits.verifyEmail.limit,
		rateLimits.verifyEmail.windowMs
	);
	if (!allowed)
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};

	const request = await getActiveVerificationRequest(userId);
	if (!request) return { error: "Verification code expired. Please request a new one." };

	if (!timingSafeCompare(request.code, parsed.output.code)) {
		return { error: "Invalid verification code. Please try again." };
	}

	await Promise.all([
		db.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, userId)),
		deleteVerificationRequests(userId),
	]);

	await deletePendingAuthCookie();
	return resolveAndCreateSession(userId, formData);
}

export async function verifyNewDeviceAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(VerifyCodeSchema, { code: formData.get("code") });
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const userId = await getPendingAuthUserId();
	if (!userId) return { error: "Session expired. Please start over." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`verify-device:${userId}`,
		rateLimits.verifyDevice.limit,
		rateLimits.verifyDevice.windowMs
	);
	if (!allowed)
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};

	const request = await getActiveVerificationRequest(userId);
	if (!request) return { error: "Verification code expired. Please sign in again." };

	if (!timingSafeCompare(request.code, parsed.output.code)) {
		return { error: "Invalid verification code. Please try again." };
	}

	await deleteVerificationRequests(userId);
	await deletePendingAuthCookie();
	return resolveAndCreateSession(userId, formData, { method: "new_device_verification" });
}

export async function resendVerificationAction(): Promise<ActionResult> {
	const userId = await getPendingAuthUserId();
	if (!userId) return { error: "Session expired. Please start over." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`resend:${userId}`,
		rateLimits.resendVerification.limit,
		rateLimits.resendVerification.windowMs
	);
	if (!allowed)
		return {
			error: `Too many resend requests. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};

	const user = await db.query.userTable.findFirst({ where: eq(userTable.id, userId) });
	if (!user) return { error: "User not found." };

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const code = await createEmailVerificationRequest(userId, user.email, client.ip);
	await sendMail({
		to: user.email,
		subject: "Your new Scrimflow verification code",
		template: (
			<VerificationEmail
				code={code}
				title="Here's your new verification code"
				message="You requested a new verification code for your Scrimflow account."
				actionText="enter the following code"
			/>
		),
	}).catch((err: unknown) => logger.error({ err }, "resend verification email failed"));

	return {};
}
