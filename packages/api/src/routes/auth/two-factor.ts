import { VerifyCodeSchema } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import {
	checkRecoveryCodeRateLimit,
	resetRecoveryCodeRateLimit,
	resetUser2faWithRecoveryCode,
} from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { setSessionAs2FAVerified } from "@/auth/session";
import { checkAndUpdateTotpCounter, checkTotpRateLimit, getUserTotpKey } from "@/auth/totp";
import { timingSafeCompare } from "@/crypto/utils";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { type AuthEnv, requireAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { formatRetryAfter } from "@/rate-limit";

import { type ActionResult, extractErrors, safeRedirectUrl } from "./utils";

const twoFactorRoutes = new Hono<RequestContextEnv & AuthEnv>();

twoFactorRoutes.use("*", requireAuth);

twoFactorRoutes.post("/totp", async (c) => {
	const body = await c.req.json<{ code?: string; next?: string }>();

	const parsed = v.safeParse(VerifyCodeSchema, { code: body.code });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkTotpRateLimit(session.userId);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);
	}

	const key = await getUserTotpKey(session.userId);
	if (!key)
		return c.json(
			{ error: "No authenticator app found. Please contact support." } satisfies ActionResult,
			400
		);

	const { generateHOTP } = await import("@oslojs/otp");

	const now = BigInt(Math.floor(Date.now() / 1000));
	const period = BigInt(30);
	const currentWindow = now / period;

	let matchedWindow: bigint | null = null;
	for (const offset of [BigInt(-1), BigInt(0), BigInt(1)]) {
		if (timingSafeCompare(generateHOTP(key, currentWindow + offset, 6), parsed.output.code)) {
			matchedWindow = currentWindow + offset;
			break;
		}
	}

	if (matchedWindow === null)
		return c.json(
			{ error: "Invalid authentication code. Please try again." } satisfies ActionResult,
			400
		);

	const accepted = await checkAndUpdateTotpCounter(session.userId, matchedWindow);
	if (!accepted)
		return c.json(
			{
				error: "This code has already been used. Please wait for a new code.",
			} satisfies ActionResult,
			400
		);
	await setSessionAs2FAVerified(session.id);

	const client = c.get("client");
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method: "totp",
	});

	return c.json({ redirect: safeRedirectUrl(body.next) } satisfies ActionResult);
});

twoFactorRoutes.post("/recovery", async (c) => {
	const body = await c.req.json<{ code?: string; next?: string }>();

	const code = body.code?.trim();
	if (!code)
		return c.json({ error: "Please enter your recovery code." } satisfies ActionResult, 400);

	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkRecoveryCodeRateLimit(session.userId);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);
	}

	const success = await resetUser2faWithRecoveryCode(session.userId, code);
	if (!success) return c.json({ error: "Invalid recovery code." } satisfies ActionResult, 400);

	await resetRecoveryCodeRateLimit(session.userId);
	await setSessionAs2FAVerified(session.id);

	const client = c.get("client");
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method: "recovery_code",
	});

	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	let newRecoveryCode: string | undefined;
	if (user?.recoveryCode) {
		const { decryptTextToString } = await import("@/crypto/encryption");
		newRecoveryCode = decryptTextToString(user.recoveryCode);
	}

	return c.json({
		next: safeRedirectUrl(body.next),
		newRecoveryCode,
	} satisfies ActionResult);
});

export { twoFactorRoutes };
