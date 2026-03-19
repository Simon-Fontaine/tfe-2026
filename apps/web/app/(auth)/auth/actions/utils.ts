import { encodeBase64 } from "@oslojs/encoding";
import { headers } from "next/headers";
import type * as v from "valibot";

import { getUserTwoFactorStatus } from "@/lib/auth/2fa";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext, resolveDevice } from "@/lib/auth/device";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@/lib/auth/session";
import { getUserPasskeyCredentials, getUserSecurityKeyCredentials } from "@/lib/auth/webauthn";
import { fetchGeoData } from "@/lib/geo";

import type { ActionResult, TwoFactorMethods } from "./types";

export type { ActionResult, TwoFactorMethods };

export function safeRedirectUrl(next: FormDataEntryValue | null): string {
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

export async function createUserSession(ctx: SessionContext): Promise<void> {
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
	await setSessionTokenCookie(token, session.expiresAt);
}

export async function resolveAndCreateSession(
	userId: string,
	formData: FormData,
	auditMetadata?: Record<string, unknown>
): Promise<ActionResult> {
	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);

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

	await createUserSession({
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

	const next = safeRedirectUrl(formData.get("next"));

	if (twoFactor.registered2FA) {
		return {
			nextStep: "two-factor",
			next,
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
	return { redirect: next };
}
