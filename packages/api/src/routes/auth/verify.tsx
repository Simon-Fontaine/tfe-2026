import { rateLimits, VerifyCodeSchema } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import {
	createEmailVerificationRequest,
	deleteVerificationRequests,
	getActiveVerificationRequest,
} from "@/auth/email-verification";
import { timingSafeCompare } from "@/crypto/utils";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import logger from "@/utils/logger";

import {
	type ActionResult,
	deletePendingCookie,
	extractErrors,
	getPendingUserId,
	resolveAndCreateSession,
} from "./utils";

const verifyRoutes = new Hono<RequestContextEnv>();

verifyRoutes.post("/email", async (c) => {
	const body = await c.req.json<{ code?: string; next?: string }>();

	const parsed = v.safeParse(VerifyCodeSchema, { code: body.code });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const userId = getPendingUserId(c);
	if (!userId)
		return c.json({ error: "Session expired. Please start over." } satisfies ActionResult, 401);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`verify-email:${userId}`,
		rateLimits.verifyEmail.limit,
		rateLimits.verifyEmail.windowMs
	);
	if (!allowed)
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);

	const request = await getActiveVerificationRequest(userId);
	if (!request)
		return c.json(
			{ error: "Verification code expired. Please request a new one." } satisfies ActionResult,
			400
		);

	if (!timingSafeCompare(request.code, parsed.output.code)) {
		return c.json(
			{ error: "Invalid verification code. Please try again." } satisfies ActionResult,
			400
		);
	}

	await Promise.all([
		db.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, userId)),
		deleteVerificationRequests(userId),
	]);

	deletePendingCookie(c);
	const result = await resolveAndCreateSession(c, userId, body.next);
	return c.json(result);
});

verifyRoutes.post("/device", async (c) => {
	const body = await c.req.json<{ code?: string; next?: string }>();

	const parsed = v.safeParse(VerifyCodeSchema, { code: body.code });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const userId = getPendingUserId(c);
	if (!userId)
		return c.json({ error: "Session expired. Please start over." } satisfies ActionResult, 401);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`verify-device:${userId}`,
		rateLimits.verifyDevice.limit,
		rateLimits.verifyDevice.windowMs
	);
	if (!allowed)
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);

	const request = await getActiveVerificationRequest(userId);
	if (!request)
		return c.json(
			{ error: "Verification code expired. Please sign in again." } satisfies ActionResult,
			400
		);

	if (!timingSafeCompare(request.code, parsed.output.code)) {
		return c.json(
			{ error: "Invalid verification code. Please try again." } satisfies ActionResult,
			400
		);
	}

	await deleteVerificationRequests(userId);
	deletePendingCookie(c);
	const result = await resolveAndCreateSession(c, userId, body.next, {
		method: "new_device_verification",
	});
	return c.json(result);
});

verifyRoutes.post("/resend", async (c) => {
	const userId = getPendingUserId(c);
	if (!userId)
		return c.json({ error: "Session expired. Please start over." } satisfies ActionResult, 401);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`resend:${userId}`,
		rateLimits.resendVerification.limit,
		rateLimits.resendVerification.windowMs
	);
	if (!allowed)
		return c.json(
			{
				error: `Too many resend requests. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);

	const user = await db.query.userTable.findFirst({ where: eq(userTable.id, userId) });
	if (!user) return c.json({ error: "User not found." } satisfies ActionResult, 404);

	const client = c.get("client");

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

	return c.json({} satisfies ActionResult);
});

export { verifyRoutes };
