import { LoginSchema, rateLimits } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { getUserTwoFactorStatus } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { type ClientContext, isKnownLocation, resolveDevice } from "@/auth/device";
import { createEmailVerificationRequest } from "@/auth/email-verification";
import { verifyPasswordHash } from "@/auth/password";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { SecurityAlertEmail } from "@/email/templates/SecurityAlertEmail";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter, resetRateLimit } from "@/rate-limit";
import { fetchGeoData, formatLocation, type GeoData } from "@/utils/geo";
import logger from "@/utils/logger";

import {
	type ActionResult,
	buildTwoFactorMethods,
	createUserSession,
	extractErrors,
	normalizeEmail,
	type SessionContext,
	safeRedirectUrl,
	setPendingCookie,
} from "./utils";

function sendNewLoginAlert(
	user: { id: string; email: string },
	client: ClientContext,
	geo: GeoData,
	isNewDevice: boolean
): void {
	sendMail({
		to: user.email,
		subject: "New sign-in detected on Scrimflow",
		template: (
			<SecurityAlertEmail
				ip={client.ip ?? "Unknown"}
				device={client.deviceName}
				location={formatLocation(geo)}
				date={new Date().toUTCString()}
				alertType={isNewDevice ? "new_device" : "new_location"}
			/>
		),
	}).catch((err: unknown) => logger.error({ err }, "new login alert email failed"));

	writeAuditLog(
		user.id,
		isNewDevice ? "new_device_detected" : "new_location_detected",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ device: client.deviceName, location: formatLocation(geo) }
	);
}

const loginRoutes = new Hono<RequestContextEnv>();

loginRoutes.post("/", async (c) => {
	const body = await c.req.json<{ email?: string; password?: string; next?: string }>();

	const parsed = v.safeParse(LoginSchema, {
		email: body.email,
		password: body.password,
	});
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const email = normalizeEmail(parsed.output.email);
	const { password } = parsed.output;
	const client = c.get("client");

	const ipKey = `login:ip:${client.ip ?? "unknown"}`;
	const emailKey = `login:email:${email}`;
	const [ipResult, emailResult] = await Promise.all([
		checkRateLimit(ipKey, rateLimits.loginIp.limit, rateLimits.loginIp.windowMs),
		checkRateLimit(emailKey, rateLimits.loginEmail.limit, rateLimits.loginEmail.windowMs),
	]);
	if (!ipResult.allowed || !emailResult.allowed) {
		const retryMs = Math.max(ipResult.retryAfterMs, emailResult.retryAfterMs);
		return c.json(
			{
				error: `Too many sign-in attempts. Please wait ${formatRetryAfter(retryMs)} before trying again.`,
			} satisfies ActionResult,
			429
		);
	}

	const user = await db.query.userTable.findFirst({ where: eq(userTable.email, email) });
	const passwordHash = user?.passwordHash ?? "$argon2id$v=19$m=19456,t=2,p=1$placeholder";
	const validPassword = await verifyPasswordHash(passwordHash, password).catch(() => false);

	if (!user || !user.passwordHash || !validPassword) {
		if (user) {
			writeAuditLog(user.id, "login_failed", client.ip, client.userAgent, null, null, {
				reason: "invalid_password",
			});
		}
		return c.json({ error: "Invalid email or password." } satisfies ActionResult, 401);
	}

	await Promise.all([resetRateLimit(ipKey), resetRateLimit(emailKey)]);

	if (user.isBanned) {
		return c.json(
			{ error: user.banReason ?? "Your account has been suspended." } satisfies ActionResult,
			403
		);
	}

	if (!user.emailVerified) {
		const code = await createEmailVerificationRequest(user.id, user.email, client.ip);
		await sendMail({
			to: user.email,
			subject: "Verify your Scrimflow email",
			template: (
				<VerificationEmail
					code={code}
					title="Verify your email address"
					message="Please verify your email address to continue signing in to Scrimflow."
					actionText="enter the following code"
				/>
			),
		}).catch((err: unknown) => logger.error({ err }, "verification email send failed"));
		setPendingCookie(c, user.id);
		return c.json({ nextStep: "verify-email", email: user.email } satisfies ActionResult);
	}

	const [geo, { deviceId, isNew: isNewDevice }] = await Promise.all([
		fetchGeoData(client.ip),
		resolveDevice(
			user.id,
			client.fingerprint,
			client.deviceName,
			client.browserName,
			client.osName,
			client.deviceType,
			client.ip,
			null,
			null
		),
	]);

	const isNewLocation = !(await isKnownLocation(user.id, geo.country));

	if (isNewDevice || isNewLocation) {
		sendNewLoginAlert(user, client, geo, isNewDevice);
	}

	const needsExtraVerification = isNewDevice || isNewLocation;
	const twoFactor = await getUserTwoFactorStatus(user.id);

	const sessionCtx: SessionContext = {
		userId: user.id,
		twoFactorVerified: false,
		ipAddress: client.ip,
		userAgent: client.userAgent,
		deviceId,
		geoCountry: geo.country,
		geoCity: geo.city,
		geoLat: geo.lat,
		geoLon: geo.lon,
	};

	if (needsExtraVerification && !twoFactor.registered2FA) {
		const code = await createEmailVerificationRequest(user.id, user.email, client.ip);
		await sendMail({
			to: user.email,
			subject: "Confirm your new sign-in location",
			template: (
				<VerificationEmail
					code={code}
					title="Verify this sign-in"
					message="We detected a sign-in from a new device or location. Enter the code below to confirm it's you."
					actionText="enter the following code"
				/>
			),
		}).catch((err: unknown) => logger.error({ err }, "device verification email send failed"));
		setPendingCookie(c, user.id);
		return c.json({
			nextStep: "new-device-verification",
			email: user.email,
			next: body.next ?? "",
		} satisfies ActionResult);
	}

	const next = safeRedirectUrl(body.next);

	if (twoFactor.registered2FA) {
		await createUserSession(c, sessionCtx);
		return c.json({
			nextStep: "two-factor",
			email: user.email,
			next,
			twoFactorMethods: await buildTwoFactorMethods(user.id, twoFactor),
		} satisfies ActionResult);
	}

	await createUserSession(c, { ...sessionCtx, twoFactorVerified: true });
	writeAuditLog(user.id, "login_success", client.ip, client.userAgent, geo.country, geo.city);
	return c.json({ redirect: next } satisfies ActionResult);
});

export { loginRoutes };
