import { Hono } from "hono";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import { writeAuditLog } from "@/auth/audit";
import { createEmailVerificationRequest } from "@/auth/email-verification";
import { hashPassword, verifyPasswordStrength } from "@/auth/password";
import { rateLimits } from "@/config/rate-limits";
import logger from "@/utils/logger";
import { sendMail } from "@/email/mailer";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { RegisterSchema } from "@scrimflow/shared";
import type { RequestContextEnv } from "@/middleware/request-context";

import { type ActionResult, extractErrors, normalizeEmail, setPendingCookie } from "./utils";

const registerRoutes = new Hono<RequestContextEnv>();

registerRoutes.post("/", async (c) => {
	const body = await c.req.json<{
		email?: string;
		username?: string;
		displayName?: string;
		password?: string;
		confirmPassword?: string;
	}>();

	const parsed = v.safeParse(RegisterSchema, {
		email: body.email,
		username: body.username,
		displayName: body.displayName || undefined,
		password: body.password,
		confirmPassword: body.confirmPassword,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const client = c.get("client");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`register:ip:${client.ip ?? "unknown"}`,
		rateLimits.registerIp.limit,
		rateLimits.registerIp.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many registration attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);
	}

	const email = normalizeEmail(parsed.output.email);
	const { username, displayName, password } = parsed.output;

	const [existingEmail, existingUsername] = await Promise.all([
		db.query.userTable.findFirst({ where: eq(userTable.email, email) }),
		db.query.userTable.findFirst({ where: eq(userTable.username, username) }),
	]);

	if (existingEmail)
		return c.json(
			{ fieldErrors: { email: ["This email is already registered."] } } satisfies ActionResult,
			409
		);
	if (existingUsername)
		return c.json(
			{ fieldErrors: { username: ["This username is already taken."] } } satisfies ActionResult,
			409
		);

	const passwordIsSafe = await verifyPasswordStrength(password);
	if (!passwordIsSafe) {
		return c.json(
			{
				fieldErrors: {
					password: [
						"This password has appeared in a known data breach. Please choose a different one.",
					],
				},
			} satisfies ActionResult,
			400
		);
	}

	const passwordHash = await hashPassword(password);

	const [newUser] = await db
		.insert(userTable)
		.values({ email, username, displayName: displayName ?? username, passwordHash })
		.returning({ id: userTable.id, email: userTable.email });

	if (!newUser)
		return c.json({ error: "Registration failed. Please try again." } satisfies ActionResult, 500);

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
	setPendingCookie(c, newUser.id);

	return c.json({ nextStep: "verify-email", email: newUser.email } satisfies ActionResult);
});

registerRoutes.get("/check-username", async (c) => {
	const username = c.req.query("username")?.trim();
	if (!username) return c.json({ available: false });

	const { allowed } = await checkRateLimit(
		`username-check:${username}`,
		rateLimits.usernameCheck.limit,
		rateLimits.usernameCheck.windowMs
	);
	if (!allowed) return c.json({ available: false });

	const existing = await db.query.userTable.findFirst({
		where: eq(userTable.username, username),
		columns: { id: true },
	});
	return c.json({ available: !existing });
});

export { registerRoutes };
