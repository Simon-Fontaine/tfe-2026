"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import { SecurityAlertEmail } from "@/emails/SecurityAlertEmail";
import { VerificationEmail } from "@/emails/VerificationEmail";
import { getUserTwoFactorStatus } from "@/lib/auth/2fa";
import { writeAuditLog } from "@/lib/auth/audit";
import {
	type ClientContext,
	extractClientContext,
	isKnownLocation,
	resolveDevice,
} from "@/lib/auth/device";
import { createEmailVerificationRequest } from "@/lib/auth/email-verification";
import { verifyPasswordHash } from "@/lib/auth/password";
import { setPendingAuthCookie } from "@/lib/auth/pending-auth";
import { rateLimits } from "@/lib/config/rate-limits";
import { fetchGeoData, formatLocation, type GeoData } from "@/lib/geo";
import logger from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, formatRetryAfter, resetRateLimit } from "@/lib/rate-limit";
import { LoginSchema } from "@/lib/validations/auth";
import {
	type ActionResult,
	buildTwoFactorMethods,
	createUserSession,
	extractErrors,
	normalizeEmail,
	type SessionContext,
	safeRedirectUrl,
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

export async function loginAction(
	_prev: ActionResult | null,
	formData: FormData
): Promise<ActionResult> {
	const parsed = v.safeParse(LoginSchema, {
		email: formData.get("email"),
		password: formData.get("password"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const email = normalizeEmail(parsed.output.email);
	const { password } = parsed.output;
	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

	const ipKey = `login:ip:${client.ip ?? "unknown"}`;
	const emailKey = `login:email:${email}`;
	const [ipResult, emailResult] = await Promise.all([
		checkRateLimit(ipKey, rateLimits.loginIp.limit, rateLimits.loginIp.windowMs),
		checkRateLimit(emailKey, rateLimits.loginEmail.limit, rateLimits.loginEmail.windowMs),
	]);
	if (!ipResult.allowed || !emailResult.allowed) {
		const retryMs = Math.max(ipResult.retryAfterMs, emailResult.retryAfterMs);
		return {
			error: `Too many sign-in attempts. Please wait ${formatRetryAfter(retryMs)} before trying again.`,
		};
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
		return { error: "Invalid email or password." };
	}

	await Promise.all([resetRateLimit(ipKey), resetRateLimit(emailKey)]);

	if (user.isBanned) {
		return { error: user.banReason ?? "Your account has been suspended." };
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
		await setPendingAuthCookie(user.id);
		return { nextStep: "verify-email", email: user.email };
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
		await setPendingAuthCookie(user.id);
		return {
			nextStep: "new-device-verification",
			email: user.email,
			next: formData.get("next")?.toString() ?? "",
		};
	}

	const next = safeRedirectUrl(formData.get("next"));

	if (twoFactor.registered2FA) {
		await createUserSession(sessionCtx);
		return {
			nextStep: "two-factor",
			email: user.email,
			next,
			twoFactorMethods: await buildTwoFactorMethods(user.id, twoFactor),
		};
	}

	await createUserSession({ ...sessionCtx, twoFactorVerified: true });
	writeAuditLog(user.id, "login_success", client.ip, client.userAgent, geo.country, geo.city);
	redirect(next);
}
