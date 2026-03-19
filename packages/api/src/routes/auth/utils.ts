import { encodeBase64 } from "@oslojs/encoding";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type * as v from "valibot";

import { getUserTwoFactorStatus } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { resolveDevice } from "@/auth/device";
import { createSession, generateSessionToken } from "@/auth/session";
import { getUserPasskeyCredentials, getUserSecurityKeyCredentials } from "@/auth/webauthn";
import { fetchGeoData } from "@/utils/geo";

export type TwoFactorMethods = {
	totp: boolean;
	passkey: boolean;
	securityKey: boolean;
	passkeyCredentialIds?: string[];
	securityKeyCredentialIds?: string[];
};

export type ActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	nextStep?: string;
	email?: string;
	next?: string;
	twoFactorMethods?: TwoFactorMethods;
	newRecoveryCode?: string;
	redirect?: string;
};

export function safeRedirectUrl(next: string | null | undefined): string {
	const url = typeof next === "string" ? next.trim() : "";
	if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/auth")) {
		return "/dashboard";
	}
	return url;
}

export function extractErrors(issues: v.BaseIssue<unknown>[]): Partial<Record<string, string[]>> {
	const result: Partial<Record<string, string[]>> = {};
	for (const issue of issues) {
		const key = issue.path?.map((p) => String(p.key)).join(".") ?? "root";
		if (!result[key]) result[key] = [];
		(result[key] as string[]).push(issue.message);
	}
	return result;
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function buildTwoFactorMethods(
	userId: string,
	status: { registeredTOTP: boolean; registeredPasskey: boolean; registeredSecurityKey: boolean }
): Promise<TwoFactorMethods> {
	const [passkeyCredentials, securityKeyCredentials] = await Promise.all([
		status.registeredPasskey ? getUserPasskeyCredentials(userId) : Promise.resolve([]),
		status.registeredSecurityKey ? getUserSecurityKeyCredentials(userId) : Promise.resolve([]),
	]);

	return {
		totp: status.registeredTOTP,
		passkey: status.registeredPasskey,
		securityKey: status.registeredSecurityKey,
		passkeyCredentialIds: passkeyCredentials.map((c) => encodeBase64(c.id)),
		securityKeyCredentialIds: securityKeyCredentials.map((c) => encodeBase64(c.id)),
	};
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
	setCookie(c, "session_token", token, {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "Lax",
		expires: expiresAt,
	});
}

export function setPendingCookie(c: Context, userId: string) {
	setCookie(c, "pending_auth_user_id", userId, {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "Lax",
		maxAge: 900,
	});
}

export function getPendingUserId(c: Context): string | undefined {
	return getCookie(c, "pending_auth_user_id");
}

export function deletePendingCookie(c: Context) {
	deleteCookie(c, "pending_auth_user_id");
}

export interface SessionContext {
	userId: string;
	twoFactorVerified: boolean;
	ipAddress: string | null;
	userAgent: string | null;
	deviceId: string | null;
	geoCountry: string | null;
	geoCity: string | null;
	geoLat: string | null;
	geoLon: string | null;
}

export async function createUserSession(c: Context, ctx: SessionContext): Promise<void> {
	const token = generateSessionToken();
	const session = await createSession(
		token,
		ctx.userId,
		{ twoFactorVerified: ctx.twoFactorVerified },
		{
			ipAddress: ctx.ipAddress,
			userAgent: ctx.userAgent,
			deviceId: ctx.deviceId,
			geoCountry: ctx.geoCountry,
			geoCity: ctx.geoCity,
			geoLat: ctx.geoLat,
			geoLon: ctx.geoLon,
		}
	);
	setSessionCookie(c, token, session.expiresAt);
}

export async function resolveAndCreateSession(
	c: Context,
	userId: string,
	next: string | null | undefined,
	auditMetadata?: Record<string, unknown>
): Promise<ActionResult> {
	const client = c.get("client");

	const [geo, { deviceId }] = await Promise.all([
		fetchGeoData(client.ip),
		resolveDevice(
			userId,
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

	const twoFactor = await getUserTwoFactorStatus(userId);

	await createUserSession(c, {
		userId,
		twoFactorVerified: !twoFactor.registered2FA,
		ipAddress: client.ip,
		userAgent: client.userAgent,
		deviceId,
		geoCountry: geo.country,
		geoCity: geo.city,
		geoLat: geo.lat,
		geoLon: geo.lon,
	});

	const redirectUrl = safeRedirectUrl(next);

	if (twoFactor.registered2FA) {
		return {
			nextStep: "two-factor",
			next: redirectUrl,
			twoFactorMethods: await buildTwoFactorMethods(userId, twoFactor),
		};
	}

	writeAuditLog(
		userId,
		"login_success",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		auditMetadata
	);
	return { redirect: redirectUrl };
}
