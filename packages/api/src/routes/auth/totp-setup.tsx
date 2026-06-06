import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { generateRecoveryCode } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
import { checkTotpUpdateRateLimit, getUserTotpKey, upsertUserTotpKey } from "@/auth/totp";
import { encryptStringToText } from "@/crypto/encryption";
import { timingSafeCompare } from "@/crypto/utils";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { type AuthEnv, requireAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

const TotpCodeSchema = v.pipe(
	v.string(),
	v.trim(),
	v.length(6, "Code must be exactly 6 digits"),
	v.regex(/^\d{6}$/, "Code must contain only digits")
);

async function ensureRecoveryCode(userId: string): Promise<string | null> {
	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (user?.recoveryCode) return null;

	const code = generateRecoveryCode();
	const encrypted = encryptStringToText(code);
	await db.update(userTable).set({ recoveryCode: encrypted }).where(eq(userTable.id, userId));
	return code;
}

const totpSetupRoutes = new Hono<RequestContextEnv & AuthEnv>();
totpSetupRoutes.use("*", requireAuth);

// POST /generate — Generate a new TOTP secret
totpSetupRoutes.post("/generate", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkTotpUpdateRateLimit(session.userId);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const secretBytes = new Uint8Array(20);
	crypto.getRandomValues(secretBytes);
	const secret = encodeBase32UpperCaseNoPadding(secretBytes);

	const issuer = encodeURIComponent("Scrimflow");
	const account = encodeURIComponent(user.email);
	const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

	return c.json({ secret, uri });
});

// POST /enable — Verify code and enable TOTP
totpSetupRoutes.post("/enable", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkTotpUpdateRateLimit(session.userId);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ secret: string; code: string }>().catch(() => null);
	if (!body?.secret || !body?.code) return c.json({ error: "Missing secret or code." }, 400);

	const parsed = v.safeParse(TotpCodeSchema, body.code);
	if (!parsed.success) return c.json({ error: "Invalid code format." }, 400);

	const { decodeBase32 } = await import("@oslojs/encoding");
	let keyBytes: Uint8Array;
	try {
		keyBytes = decodeBase32(body.secret);
	} catch {
		return c.json({ error: "Invalid secret." }, 400);
	}

	const { generateHOTP } = await import("@oslojs/otp");
	const now = BigInt(Math.floor(Date.now() / 1000));
	const period = BigInt(30);
	const currentWindow = now / period;

	let valid = false;
	for (const offset of [BigInt(-1), BigInt(0), BigInt(1)]) {
		if (timingSafeCompare(generateHOTP(keyBytes, currentWindow + offset, 6), parsed.output)) {
			valid = true;
			break;
		}
	}

	if (!valid) {
		return c.json(
			{ error: "Invalid code. Make sure your authenticator app is showing the correct code." },
			400
		);
	}

	await upsertUserTotpKey(session.userId, keyBytes);

	const recoveryCode = await ensureRecoveryCode(session.userId);
	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
		twoFactorMethod: "totp",
	});

	writeAuditLog(
		session.userId,
		"two_factor_enable",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			method: "totp",
		}
	);

	return c.json({ success: true, ...(recoveryCode ? { recoveryCode } : {}) });
});

// GET /status — Check if TOTP is enabled
totpSetupRoutes.get("/status", async (c) => {
	const session = c.get("session");
	const key = await getUserTotpKey(session.userId);
	return c.json({ enabled: key !== null });
});

export { totpSetupRoutes };
