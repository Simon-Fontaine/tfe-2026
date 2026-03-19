"use server";

import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import {
	ClientDataType,
	createAssertionSignatureMessage,
	parseAuthenticatorData,
	parseClientDataJSON,
} from "@oslojs/webauthn";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext, resolveDevice } from "@/lib/auth/device";
import {
	createSession,
	generateSessionToken,
	getCurrentSession,
	setSessionAs2FAVerified,
	setSessionTokenCookie,
} from "@/lib/auth/session";
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
} from "@/lib/auth/webauthn";
import { rateLimits } from "@/lib/config/rate-limits";
import { fetchGeoData } from "@/lib/geo";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";

interface AssertionData {
	credentialId: string; // base64
	authenticatorData: string; // base64
	clientDataJSON: string; // base64
	signature: string; // base64
}

interface VerifyResult {
	error?: string;
}

export async function createWebAuthnChallengeAction(): Promise<string> {
	const challenge = await createWebAuthnChallenge();
	return encodeBase64(challenge);
}

// ─── Shared verification logic ─────────────────────────────────────────────────

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

async function verifyAssertion(
	credential: WebAuthnUserCredential | null,
	data: AssertionData,
	method: string
): Promise<VerifyResult> {
	if (!credential) return { error: "Credential not found." };

	const authenticatorDataBytes = decodeBase64(data.authenticatorData);
	const clientDataJSONBytes = decodeBase64(data.clientDataJSON);
	const signatureBytes = decodeBase64(data.signature);

	// 1. Parse and validate clientDataJSON
	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Get) {
		return { error: "Invalid credential type." };
	}
	if (clientData.origin !== ORIGIN) {
		return { error: "Invalid origin." };
	}

	// 2. Verify the challenge was issued by us (single-use consumption)
	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) {
		return { error: "Challenge expired or already used." };
	}

	// 3. Parse and validate authenticatorData
	const authData = parseAuthenticatorData(authenticatorDataBytes);
	if (!authData.verifyRelyingPartyIdHash(RP_ID)) {
		return { error: "Invalid relying party." };
	}
	if (!authData.userPresent) {
		return { error: "User presence not confirmed." };
	}

	// 4. Verify signature counter (WebAuthn §6.1.1 step 21)
	//    A counter that doesn't increase indicates a cloned authenticator.
	//    signCount === 0 means the authenticator doesn't support counters — skip the check.
	const newSignCount = BigInt(authData.signatureCounter);
	if (credential.signCount > BigInt(0) || newSignCount > BigInt(0)) {
		if (newSignCount <= credential.signCount) {
			return { error: "Authenticator counter did not increase. Possible cloned credential." };
		}
	}

	// 5. Verify signature
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
	if (!signatureValid) {
		return { error: "Signature verification failed." };
	}

	// 6. Mark session as 2FA verified
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	await setSessionAs2FAVerified(session.id);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	writeAuditLog(session.userId, "login_success", client.ip, client.userAgent, null, null, {
		method,
	});

	// Return the new sign count so the caller can persist it.
	return { _signCount: newSignCount } as VerifyResult & { _signCount: bigint };
}

// ─── Passkey 2FA verification ──────────────────────────────────────────────────

/** Verifies a passkey assertion for 2FA (user-scoped lookup, not discoverable). */
export async function verifyPasskey2faAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	// Rate limit
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:${session.userId}`,
		rateLimits.webauthnVerify.limit,
		rateLimits.webauthnVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	let data: AssertionData;
	try {
		data = JSON.parse(encodedData);
	} catch {
		return { error: "Invalid credential data." };
	}

	const credentialId = decodeBase64(data.credentialId);
	const credential = await getUserPasskeyCredential(session.userId, credentialId);

	const result = await verifyAssertion(credential, data, "passkey");
	if (result.error) return result;

	// Update sign count after successful verification
	const signCount = (result as VerifyResult & { _signCount?: bigint })._signCount;
	if (credential && signCount !== undefined) {
		await updatePasskeySignCount(session.userId, credentialId, signCount);
	}

	redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

// ─── Security key 2FA verification ─────────────────────────────────────────────

/** Verifies a security key assertion for 2FA. */
export async function verifySecurityKey2faAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired. Please sign in again." };

	// Rate limit
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:${session.userId}`,
		rateLimits.webauthnVerify.limit,
		rateLimits.webauthnVerify.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	let data: AssertionData;
	try {
		data = JSON.parse(encodedData);
	} catch {
		return { error: "Invalid credential data." };
	}

	const credentialId = decodeBase64(data.credentialId);
	const credential = await getUserSecurityKeyCredential(session.userId, credentialId);

	const result = await verifyAssertion(credential, data, "security_key");
	if (result.error) return result;

	// Update sign count after successful verification
	const signCount = (result as VerifyResult & { _signCount?: bigint })._signCount;
	if (credential && signCount !== undefined) {
		await updateSecurityKeySignCount(session.userId, credentialId, signCount);
	}

	redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

// ─── Discoverable passkey login (usernameless) ─────────────────────────────────

interface DiscoverableAssertionData extends AssertionData {
	userHandle: string | null; // base64-encoded user ID from the authenticator
}

/**
 * Logs a user in using a discoverable passkey (no username/password required).
 * The authenticator selects the credential; the server looks it up by credential ID.
 * Passkey login inherently satisfies 2FA, so the session is marked as 2FA-verified.
 */
export async function loginWithPasskeyAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	// Rate limit by IP
	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const { allowed, retryAfterMs } = await checkRateLimit(
		`passkey-login:ip:${client.ip ?? "unknown"}`,
		rateLimits.passkeyLoginIp.limit,
		rateLimits.passkeyLoginIp.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	let data: DiscoverableAssertionData;
	try {
		data = JSON.parse(encodedData);
	} catch {
		return { error: "Invalid credential data." };
	}

	const credentialId = decodeBase64(data.credentialId);

	// Look up the credential by ID alone (not user-scoped)
	const credential = await getPasskeyCredential(credentialId);
	if (!credential)
		return { error: "Passkey not recognized. Please use a different sign-in method." };

	const authenticatorDataBytes = decodeBase64(data.authenticatorData);
	const clientDataJSONBytes = decodeBase64(data.clientDataJSON);
	const signatureBytes = decodeBase64(data.signature);

	// 1. Parse and validate clientDataJSON
	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Get) {
		return { error: "Invalid credential type." };
	}
	if (clientData.origin !== ORIGIN) {
		return { error: "Invalid origin." };
	}

	// 2. Verify the challenge was issued by us
	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) {
		return { error: "Challenge expired or already used." };
	}

	// 3. Parse and validate authenticatorData
	const authData = parseAuthenticatorData(authenticatorDataBytes);
	if (!authData.verifyRelyingPartyIdHash(RP_ID)) {
		return { error: "Invalid relying party." };
	}
	if (!authData.userPresent) {
		return { error: "User presence not confirmed." };
	}
	if (!authData.userVerified) {
		return { error: "User verification required for passkey login." };
	}

	// 4. Verify signature counter
	const newSignCount = BigInt(authData.signatureCounter);
	if (credential.signCount > BigInt(0) || newSignCount > BigInt(0)) {
		if (newSignCount <= credential.signCount) {
			return { error: "Authenticator counter did not increase. Possible cloned credential." };
		}
	}

	// 5. Verify signature
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
	if (!signatureValid) {
		return { error: "Signature verification failed." };
	}

	// 6. Update sign count
	await updatePasskeySignCount(credential.userId, credentialId, newSignCount);

	// 7. Create a fully verified session (passkey login satisfies 2FA)
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
	await setSessionTokenCookie(token, session.expiresAt);

	writeAuditLog(
		credential.userId,
		"login_success",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			method: "passkey_discoverable",
		}
	);

	redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
