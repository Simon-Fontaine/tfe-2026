"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import {
	checkRecoveryCodeRateLimit,
	resetRecoveryCodeRateLimit,
	resetUser2faWithRecoveryCode,
} from "@/lib/auth/2fa";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { getCurrentSession, setSessionAs2FAVerified } from "@/lib/auth/session";
import { checkAndUpdateTotpCounter, checkTotpRateLimit, getUserTotpKey } from "@/lib/auth/totp";
import { formatRetryAfter } from "@/lib/rate-limit";
import { VerifyCodeSchema } from "@/lib/validations/auth";
import { type ActionResult, extractErrors, safeRedirectUrl } from "./utils";

export async function twoFactorAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(VerifyCodeSchema, { code: formData.get("code") });
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkTotpRateLimit(session.userId);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const key = await getUserTotpKey(session.userId);
	if (!key) return { error: "No authenticator app found. Please contact support." };

	const { generateHOTP } = await import("@oslojs/otp");

	const now = BigInt(Math.floor(Date.now() / 1000));
	const period = BigInt(30);
	const currentWindow = now / period;

	let matchedWindow: bigint | null = null;
	for (const offset of [BigInt(-1), BigInt(0), BigInt(1)]) {
		if (generateHOTP(key, currentWindow + offset, 6) === parsed.output.code) {
			matchedWindow = currentWindow + offset;
			break;
		}
	}

	if (matchedWindow === null) return { error: "Invalid authentication code. Please try again." };

	const accepted = await checkAndUpdateTotpCounter(session.userId, matchedWindow);
	if (!accepted) return { error: "This code has already been used. Please wait for a new code." };
	await setSessionAs2FAVerified(session.id);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method: "totp",
	});

	redirect(safeRedirectUrl(formData.get("next")));
}

export async function recoveryCodeAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const code = formData.get("code")?.toString()?.trim();
	if (!code) return { error: "Please enter your recovery code." };

	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRecoveryCodeRateLimit(session.userId);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const success = await resetUser2faWithRecoveryCode(session.userId, code);
	if (!success) return { error: "Invalid recovery code." };

	await resetRecoveryCodeRateLimit(session.userId);
	await setSessionAs2FAVerified(session.id);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
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
		const { decryptTextToString } = await import("@/lib/encryption");
		newRecoveryCode = decryptTextToString(user.recoveryCode);
	}

	return {
		next: safeRedirectUrl(formData.get("next")),
		newRecoveryCode,
	};
}
