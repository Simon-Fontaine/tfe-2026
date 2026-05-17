import { ChangePasswordSchema, rateLimits } from "@scrimflow/shared";
import { and, eq, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
import { hashPassword, verifyPasswordHash } from "@/auth/password";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/auth/sensitive-action";
import { db } from "@/db";
import { sessionTable, userTable } from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { disconnectChatSession } from "@/realtime/chat-hub";
import { disconnectRealtimeSession } from "@/realtime/scrim-hub";
import { extractErrors } from "@/routes/auth/utils";
import { fetchGeoData } from "@/utils/geo";

const passwordRoutes = new Hono<RequestContextEnv & AuthEnv>();

// POST /request — Request password change
passwordRoutes.post("/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-password:${session.userId}`,
		rateLimits.changePassword.limit,
		rateLimits.changePassword.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ currentPassword: string }>().catch(() => null);
	if (!body?.currentPassword) return c.json({ error: "Current password is required." }, 400);

	const userRow = await db
		.select({ passwordHash: userTable.passwordHash })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!userRow?.passwordHash) {
		return c.json(
			{
				error:
					"Your account uses passkey-only login and has no password set. You can set a password from the password reset flow.",
			},
			400
		);
	}

	const isValid = await verifyPasswordHash(userRow.passwordHash, body.currentPassword);
	if (!isValid) return c.json({ error: "Current password is incorrect." }, 400);

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"password_change",
		{},
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm your password change",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm your password change"
				message="You requested to change the password on your Scrimflow account. Enter the code below to confirm."
				actionText="enter the following verification code"
			/>
		),
	});

	return c.json({ success: true });
});

// POST /confirm — Confirm password change with code
passwordRoutes.post("/confirm", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-password-verify:${session.userId}`,
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

	const rawBody = await c.req.json().catch(() => null);
	if (!rawBody) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ChangePasswordSchema, rawBody);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"password_change",
		parsed.output.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const newHash = await hashPassword(parsed.output.newPassword);
	await db.update(userTable).set({ passwordHash: newHash }).where(eq(userTable.id, session.userId));

	const revokedSessionIds = await db
		.select({ id: sessionTable.id })
		.from(sessionTable)
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		)
		.then((rows) => rows.map((row) => row.id));

	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: "password_change" })
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		);

	for (const revokedSessionId of revokedSessionIds) {
		disconnectRealtimeSession(revokedSessionId, "session_revoked");
		disconnectChatSession(revokedSessionId, "session_revoked");
	}

	await deleteSensitiveActionVerification(session.userId, "password_change");

	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "password_changed",
	});

	writeAuditLog(
		session.userId,
		"password_change",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		undefined
	);

	return c.json({ success: true });
});

// DELETE /request — Cancel pending password change
passwordRoutes.delete("/request", async (c) => {
	const session = c.get("session");
	await deleteSensitiveActionVerification(session.userId, "password_change");
	return c.json({ success: true });
});

export { passwordRoutes };
