import { rateLimits } from "@scrimflow/shared";
import { and, eq, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
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
import { fetchGeoData } from "@/utils/geo";

const emailRoutes = new Hono<RequestContextEnv & AuthEnv>();

// POST /request — Request email change
emailRoutes.post("/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`email-change-request:${session.userId}`,
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

	const body = await c.req.json<{ newEmail: string }>().catch(() => null);
	if (!body?.newEmail) return c.json({ error: "New email is required." }, 400);

	const parsed = v.safeParse(
		v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("Email is required"),
			v.email("Invalid email address"),
			v.maxLength(255)
		),
		body.newEmail
	);
	if (!parsed.success) return c.json({ error: "Invalid email address." }, 400);

	const normalizedEmail = parsed.output.toLowerCase();
	if (normalizedEmail === user.email.toLowerCase()) {
		return c.json({ error: "New email must be different from your current email." }, 400);
	}

	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.email, normalizedEmail))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) return c.json({ error: "This email address is already in use." }, 409);

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"email_change",
		{ newEmail: normalizedEmail },
		client.ip
	);

	await sendMail({
		to: normalizedEmail,
		subject: "Verify your new email address",
		template: (
			<VerificationEmail
				code={code}
				title="Verify your new email address"
				message="You recently requested to change the email address on your Scrimflow account. Enter the code below to confirm the change."
				actionText="enter the following verification code"
			/>
		),
	});

	return c.json({ success: true });
});

// POST /verify — Verify email change with code
emailRoutes.post("/verify", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`email-change-verify:${session.userId}`,
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

	const body = await c.req.json<{ code: string }>().catch(() => null);
	if (!body?.code) return c.json({ error: "Code is required." }, 400);

	const result = await validateAndConsumeSensitiveAction(session.userId, "email_change", body.code);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	const newEmail = result.metadata?.newEmail;
	if (typeof newEmail !== "string") {
		return c.json({ error: "Verification session expired. Please start again." }, 400);
	}

	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(and(eq(userTable.email, newEmail), ne(userTable.id, session.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) {
		await deleteSensitiveActionVerification(session.userId, "email_change");
		return c.json({ error: "This email address is no longer available." }, 409);
	}

	await db
		.update(userTable)
		.set({ email: newEmail, emailVerified: true })
		.where(eq(userTable.id, session.userId));

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
		.set({ revokedAt: new Date(), revocationReason: "email_change" })
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

	await deleteSensitiveActionVerification(session.userId, "email_change");

	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "email_changed",
	});

	writeAuditLog(
		session.userId,
		"email_change_complete",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			oldEmail: user.email,
			newEmail,
		}
	);

	return c.json({ success: true });
});

// DELETE /request — Cancel pending email change
emailRoutes.delete("/request", async (c) => {
	const session = c.get("session");
	await deleteSensitiveActionVerification(session.userId, "email_change");
	return c.json({ success: true });
});

export { emailRoutes };
