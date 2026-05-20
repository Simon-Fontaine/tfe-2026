import { rateLimits } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { generateRecoveryCode } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/auth/sensitive-action";
import { encryptStringToText } from "@/crypto/encryption";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

const securityRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET /summary — Check if user has a password and recovery code set (for security settings page)
securityRoutes.get("/summary", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ passwordHash: userTable.passwordHash, recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return c.json({
		data: { hasPassword: !!row?.passwordHash, hasRecoveryCode: !!row?.recoveryCode },
	});
});

securityRoutes.post("/recovery-code/regenerate/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`recovery-code-regenerate-request:${session.userId}`,
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

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"recovery_code_regenerate",
		{},
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm regenerating your recovery code",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm recovery code regeneration"
				message="You requested a new Scrimflow recovery code. Your existing recovery code will stop working after confirmation."
				actionText="enter the following verification code to confirm"
			/>
		),
	});

	return c.json({ success: true });
});

// POST /recovery-code/regenerate/confirm — Store encrypted, return plaintext once
securityRoutes.post("/recovery-code/regenerate/confirm", async (c) => {
	const session = c.get("session");
	const body = await c.req.json<{ code: string }>().catch(() => null);
	if (!body?.code) return c.json({ error: "Code is required." }, 400);

	const { allowed, retryAfterMs } = await checkRateLimit(
		`recovery-code-regenerate-verify:${session.userId}`,
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

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"recovery_code_regenerate",
		body.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const plainCode = generateRecoveryCode();
	const encrypted = encryptStringToText(plainCode);
	await db
		.update(userTable)
		.set({ recoveryCode: encrypted })
		.where(eq(userTable.id, session.userId));

	await deleteSensitiveActionVerification(session.userId, "recovery_code_regenerate");
	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);
	writeAuditLog(
		session.userId,
		"recovery_codes_regenerate",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		undefined
	);

	// Return plaintext ONCE — never log it
	return c.json({ data: { recoveryCode: plainCode } });
});

securityRoutes.post("/recovery-code/regenerate", (c) =>
	c.json(
		{
			error:
				"Recovery code regeneration requires email verification. Request a verification code first.",
		},
		400
	)
);

export { securityRoutes };
