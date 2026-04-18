import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import {
	ClientDataType,
	createAssertionSignatureMessage,
	parseAuthenticatorData,
	parseClientDataJSON,
} from "@oslojs/webauthn";
import { appRoutes, rateLimits } from "@scrimflow/shared";
import { Hono } from "hono";
import { writeAuditLog } from "@/auth/audit";
import { resolveDevice } from "@/auth/device";
import { createSession, generateSessionToken, setSessionAs2FAVerified } from "@/auth/session";
import {
	createWebAuthnChallenge,
	getPasskeyCredential,
	getUserPasskeyCredential,
	getUserSecurityKeyCredential,
	updatePasskeySignCount,
	updateSecurityKeySignCount,
	verifyWebAuthnChallenge,
	verifyWebAuthnSignature,
	type WebAuthnUserCredential,
} from "@/auth/webauthn";
import { type AuthEnv, requireAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

import { setSessionCookie } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssertionData {
	credentialId: string;
	authenticatorData: string;
	clientDataJSON: string;
	signature: string;
}

interface DiscoverableAssertionData extends AssertionData {
	userHandle: string | null;
}

interface VerifyResult {
	error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

// ─── Shared verification ──────────────────────────────────────────────────────

async function verifyAssertion(
	credential: WebAuthnUserCredential | null,
	data: AssertionData,
	_method: string
): Promise<VerifyResult & { _signCount?: bigint }> {
	if (!credential) return { error: "Credential not found." };

	const authenticatorDataBytes = decodeBase64(data.authenticatorData);
	const clientDataJSONBytes = decodeBase64(data.clientDataJSON);
	const signatureBytes = decodeBase64(data.signature);

	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Get) return { error: "Invalid credential type." };
	if (clientData.origin !== ORIGIN) return { error: "Invalid origin." };

	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) return { error: "Challenge expired or already used." };

	const authData = parseAuthenticatorData(authenticatorDataBytes);
	if (!authData.verifyRelyingPartyIdHash(RP_ID)) return { error: "Invalid relying party." };
	if (!authData.userPresent) return { error: "User presence not confirmed." };

	const newSignCount = BigInt(authData.signatureCounter);
	if (credential.signCount > BigInt(0) || newSignCount > BigInt(0)) {
		if (newSignCount <= credential.signCount) {
			return { error: "Authenticator counter did not increase. Possible cloned credential." };
		}
	}

	const signatureMessage = createAssertionSignatureMessage(
		authenticatorDataBytes,
		clientDataJSONBytes
	);
	const signatureValid = await verifyWebAuthnSignature(
		credential.publicKey,
		credential.algorithmId,
		signatureMessage,
		signatureBytes
	);
	if (!signatureValid) return { error: "Signature verification failed." };

	return { _signCount: newSignCount };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const webauthnRoutes = new Hono<RequestContextEnv & AuthEnv>();

// POST /challenge — Generate WebAuthn assertion challenge
webauthnRoutes.post("/challenge", async (c) => {
	const challenge = await createWebAuthnChallenge();
	return c.json({ challenge: encodeBase64(challenge) });
});

// POST /passkey/verify — Verify passkey assertion for 2FA
webauthnRoutes.post("/passkey/verify", requireAuth, async (c) => {
	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:${session.userId}`,
		rateLimits.webauthnVerify.limit,
		rateLimits.webauthnVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<AssertionData & { next?: string }>().catch(() => null);
	if (!body) return c.json({ error: "Invalid credential data." }, 400);

	const credentialId = decodeBase64(body.credentialId);
	const credential = await getUserPasskeyCredential(session.userId, credentialId);

	const result = await verifyAssertion(credential, body, "passkey");
	if (result.error) return c.json({ error: result.error }, 400);

	await setSessionAs2FAVerified(session.id);

	if (credential && result._signCount !== undefined) {
		await updatePasskeySignCount(session.userId, credentialId, result._signCount);
	}

	const client = c.get("client");
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method: "passkey",
	});

	const redirect =
		body.next?.startsWith("/") && !body.next.startsWith("//") ? body.next : appRoutes.root;

	return c.json({ redirect });
});

// POST /security-key/verify — Verify security key assertion for 2FA
webauthnRoutes.post("/security-key/verify", requireAuth, async (c) => {
	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:${session.userId}`,
		rateLimits.webauthnVerify.limit,
		rateLimits.webauthnVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<AssertionData & { next?: string }>().catch(() => null);
	if (!body) return c.json({ error: "Invalid credential data." }, 400);

	const credentialId = decodeBase64(body.credentialId);
	const credential = await getUserSecurityKeyCredential(session.userId, credentialId);

	const result = await verifyAssertion(credential, body, "security_key");
	if (result.error) return c.json({ error: result.error }, 400);

	await setSessionAs2FAVerified(session.id);

	if (credential && result._signCount !== undefined) {
		await updateSecurityKeySignCount(session.userId, credentialId, result._signCount);
	}

	const client = c.get("client");
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method: "security_key",
	});

	const redirect =
		body.next?.startsWith("/") && !body.next.startsWith("//") ? body.next : appRoutes.root;

	return c.json({ redirect });
});

// POST /passkey/login — Discoverable passkey login (usernameless)
webauthnRoutes.post("/passkey/login", async (c) => {
	const client = c.get("client");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-login:ip:${client.ip ?? "unknown"}`,
		rateLimits.passkeyLoginIp.limit,
		rateLimits.passkeyLoginIp.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<DiscoverableAssertionData>().catch(() => null);
	if (!body) return c.json({ error: "Invalid credential data." }, 400);

	const credentialId = decodeBase64(body.credentialId);
	const credential = await getPasskeyCredential(credentialId);
	if (!credential) {
		return c.json({ error: "Passkey not recognized. Please use a different sign-in method." }, 400);
	}

	const authenticatorDataBytes = decodeBase64(body.authenticatorData);
	const clientDataJSONBytes = decodeBase64(body.clientDataJSON);
	const signatureBytes = decodeBase64(body.signature);

	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Get) {
		return c.json({ error: "Invalid credential type." }, 400);
	}
	if (clientData.origin !== ORIGIN) {
		return c.json({ error: "Invalid origin." }, 400);
	}

	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) {
		return c.json({ error: "Challenge expired or already used." }, 400);
	}

	const authData = parseAuthenticatorData(authenticatorDataBytes);
	if (!authData.verifyRelyingPartyIdHash(RP_ID)) {
		return c.json({ error: "Invalid relying party." }, 400);
	}
	if (!authData.userPresent) return c.json({ error: "User presence not confirmed." }, 400);
	if (!authData.userVerified) {
		return c.json({ error: "User verification required for passkey login." }, 400);
	}

	const newSignCount = BigInt(authData.signatureCounter);
	if (credential.signCount > BigInt(0) || newSignCount > BigInt(0)) {
		if (newSignCount <= credential.signCount) {
			return c.json(
				{
					error: "Authenticator counter did not increase. Possible cloned credential.",
				},
				400
			);
		}
	}

	const signatureMessage = createAssertionSignatureMessage(
		authenticatorDataBytes,
		clientDataJSONBytes
	);
	const signatureValid = await verifyWebAuthnSignature(
		credential.publicKey,
		credential.algorithmId,
		signatureMessage,
		signatureBytes
	);
	if (!signatureValid) return c.json({ error: "Signature verification failed." }, 400);

	await updatePasskeySignCount(credential.userId, credentialId, newSignCount);

	const [geo, { deviceId }] = await Promise.all([
		fetchGeoData(client.ip),
		resolveDevice(
			credential.userId,
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

	const token = generateSessionToken();
	const session = await createSession(
		token,
		credential.userId,
		{ twoFactorVerified: true },
		{
			ipAddress: client.ip,
			userAgent: client.userAgent,
			deviceId,
			geoCountry: geo.country,
			geoCity: geo.city,
			geoLat: geo.lat,
			geoLon: geo.lon,
		}
	);
	setSessionCookie(c, token, session.expiresAt);

	writeAuditLog(
		credential.userId,
		"login_success",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ method: "passkey_discoverable" }
	);

	const { next } = body as { next?: string };
	const redirect = next?.startsWith("/") && !next.startsWith("//") ? next : appRoutes.root;

	return c.json({ redirect });
});

export { webauthnRoutes };
