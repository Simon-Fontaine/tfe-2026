"use server";

import { decodeBase64, encodeBase32UpperCaseNoPadding, encodeBase64 } from "@oslojs/encoding";
import {
	ClientDataType,
	coseAlgorithmES256,
	coseAlgorithmRS256,
	parseAttestationObject,
	parseClientDataJSON,
} from "@oslojs/webauthn";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { sendSecurityAlertEmail } from "@/lib/auth/email-security";
import { getCurrentSession } from "@/lib/auth/session";
import {
	createPasskeyCredential,
	createSecurityKeyCredential,
	decodeCOSEMapWithSize,
	deleteUserPasskeyCredential,
	deleteUserSecurityKeyCredential,
	getUserPasskeyCredentials,
	getUserSecurityKeyCredentials,
	verifyWebAuthnChallenge,
} from "@/lib/auth/webauthn";
import { rateLimits } from "@/lib/config/rate-limits";
import { encryptStringToText } from "@/lib/encryption";
import { fetchGeoData } from "@/lib/geo";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SetupResult {
	error?: string;
	success?: boolean;
}

interface AttestationData {
	credentialId: string; // base64
	attestationObject: string; // base64
	clientDataJSON: string; // base64
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

const SUPPORTED_ALGORITHMS = new Set([coseAlgorithmES256, coseAlgorithmRS256]);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a random base32 recovery code. */
function generateRecoveryCode(): string {
	const bytes = new Uint8Array(10);
	crypto.getRandomValues(bytes);
	return encodeBase32UpperCaseNoPadding(bytes);
}

/** Ensures the user has a recovery code. Creates one if missing. */
async function ensureRecoveryCode(userId: string): Promise<string | null> {
	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (user?.recoveryCode) return null; // Already has one

	const code = generateRecoveryCode();
	const encrypted = encryptStringToText(code);
	await db.update(userTable).set({ recoveryCode: encrypted }).where(eq(userTable.id, userId));
	return code;
}

/**
 * Extracts raw COSE public key bytes from the attestation object.
 * Avoids lossy parsing by extracting the CBOR bytes directly.
 */
function extractPublicKeyBytesFromAuthData(attestationObjectBytes: Uint8Array): Uint8Array {
	const authDataBytes = extractRawAuthData(attestationObjectBytes);

	// Fixed header: 32 (rpIdHash) + 1 (flags) + 4 (signatureCounter) = 37 bytes
	const flags = authDataBytes[32];
	if (flags === undefined) throw new Error("Auth data too short");
	if ((flags & 0x40) === 0) throw new Error("No attested credential data in auth data");

	// Skip header (37) + AAGUID (16) = offset 53
	let offset = 53;

	// 2-byte big-endian credential ID length
	const credIdLenHigh = authDataBytes[offset];
	const credIdLenLow = authDataBytes[offset + 1];
	if (credIdLenHigh === undefined || credIdLenLow === undefined) {
		throw new Error("Auth data too short for credential ID length");
	}
	offset += 2 + ((credIdLenHigh << 8) | credIdLenLow);

	// Everything from offset onwards starts the COSE public key (raw CBOR).
	// Use decodeCOSEMapWithSize to determine the exact byte count.
	const coseKeyBytes = authDataBytes.slice(offset);
	const [, size] = decodeCOSEMapWithSize(coseKeyBytes);
	return coseKeyBytes.slice(0, size);
}

/** Extracts raw authData bytes from an attestation object. */
function extractRawAuthData(attestationObjectBytes: Uint8Array): Uint8Array {
	let offset = 0;

	function readByte(): number {
		const val = attestationObjectBytes[offset];
		if (val === undefined) throw new Error("Unexpected end of CBOR data");
		offset++;
		return val;
	}

	function readUint(info: number): number {
		if (info < 24) return info;
		if (info === 24) return readByte();
		if (info === 25) return (readByte() << 8) | readByte();
		if (info === 26)
			return ((readByte() << 24) | (readByte() << 16) | (readByte() << 8) | readByte()) >>> 0;
		throw new Error("Unsupported CBOR uint size");
	}

	function skipValue(): void {
		const initial = readByte();
		const majorType = initial >> 5;
		const info = initial & 0x1f;
		switch (majorType) {
			case 0:
			case 1:
				readUint(info);
				break;
			case 2:
			case 3:
				offset += readUint(info);
				break;
			case 4:
				for (let i = 0, len = readUint(info); i < len; i++) skipValue();
				break;
			case 5:
				for (let i = 0, len = readUint(info); i < len; i++) {
					skipValue();
					skipValue();
				}
				break;
			default:
				throw new Error(`Unsupported CBOR type ${majorType}`);
		}
	}

	// Parse the top-level map
	const firstByte = readByte();
	if (firstByte >> 5 !== 5) throw new Error("Expected CBOR map");
	const mapLen = readUint(firstByte & 0x1f);

	for (let i = 0; i < mapLen; i++) {
		const keyInitial = readByte();
		if (keyInitial >> 5 === 3) {
			const keyLen = readUint(keyInitial & 0x1f);
			const keyStr = new TextDecoder().decode(
				attestationObjectBytes.slice(offset, offset + keyLen)
			);
			offset += keyLen;

			if (keyStr === "authData") {
				const valInitial = readByte();
				const valLen = readUint(valInitial & 0x1f);
				return attestationObjectBytes.slice(offset, offset + valLen);
			}
			skipValue();
		} else {
			offset += readUint(keyInitial & 0x1f);
			skipValue();
		}
	}

	throw new Error("authData not found in attestation object");
}

// ─── Shared registration logic ─────────────────────────────────────────────────

async function verifyAndExtractRegistration(
	encodedData: string
): Promise<
	{ error: string } | { credentialId: Uint8Array; publicKeyBytes: Uint8Array; algorithmId: number }
> {
	let data: AttestationData;
	try {
		data = JSON.parse(encodedData);
	} catch {
		return { error: "Invalid credential data." };
	}

	const attestationObjectBytes = decodeBase64(data.attestationObject);
	const clientDataJSONBytes = decodeBase64(data.clientDataJSON);

	// 1. Parse and validate clientDataJSON
	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Create) {
		return { error: "Invalid credential type." };
	}
	if (clientData.origin !== ORIGIN) {
		return { error: "Invalid origin." };
	}

	// 2. Verify the challenge was issued by us (single-use)
	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) {
		return { error: "Challenge expired or already used." };
	}

	// 3. Parse attestation object
	const attestation = parseAttestationObject(attestationObjectBytes);
	const authData = attestation.authenticatorData;

	if (!authData.verifyRelyingPartyIdHash(RP_ID)) {
		return { error: "Invalid relying party." };
	}
	if (!authData.userPresent) {
		return { error: "User presence not confirmed." };
	}

	const credential = authData.credential;
	if (!credential) {
		return { error: "No credential in attestation data." };
	}

	// 4. Get the algorithm
	const pk = credential.publicKey;
	const algorithmId = pk.isAlgorithmDefined() ? pk.algorithm() : coseAlgorithmES256;
	if (!SUPPORTED_ALGORITHMS.has(algorithmId)) {
		return { error: "Unsupported credential algorithm." };
	}

	// 5. Extract public key bytes for storage
	let publicKeyBytes: Uint8Array;
	try {
		publicKeyBytes = extractPublicKeyBytesFromAuthData(attestationObjectBytes);
	} catch {
		return { error: "Failed to extract public key." };
	}

	return {
		credentialId: credential.id,
		publicKeyBytes,
		algorithmId,
	};
}

// ─── Passkey registration ──────────────────────────────────────────────────────

export async function registerPasskeyAction(
	encodedData: string,
	name: string
): Promise<SetupResult & { recoveryCode?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: passkey registration
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:register:${session.userId}`,
		rateLimits.webauthnRegister.limit,
		rateLimits.webauthnRegister.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const credName = name.trim() || "My Passkey";
	const result = await verifyAndExtractRegistration(encodedData);
	if ("error" in result) return result;

	await createPasskeyCredential({
		id: result.credentialId,
		userId: session.userId,
		name: credName,
		algorithmId: result.algorithmId,
		publicKey: result.publicKeyBytes,
		signCount: BigInt(0),
	});

	// Ensure recovery code exists (first 2FA credential)
	const recoveryCode = await ensureRecoveryCode(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
	});

	writeAuditLog(
		session.userId,
		"passkey_register",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialName: credName,
		}
	);

	return { success: true, ...(recoveryCode ? { recoveryCode } : {}) };
}

// ─── Security key registration ─────────────────────────────────────────────────

export async function registerSecurityKeyAction(
	encodedData: string,
	name: string
): Promise<SetupResult & { recoveryCode?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: security key registration
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:register:${session.userId}`,
		rateLimits.webauthnRegister.limit,
		rateLimits.webauthnRegister.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const credName = name.trim() || "My Security Key";
	const result = await verifyAndExtractRegistration(encodedData);
	if ("error" in result) return result;

	await createSecurityKeyCredential({
		id: result.credentialId,
		userId: session.userId,
		name: credName,
		algorithmId: result.algorithmId,
		publicKey: result.publicKeyBytes,
		signCount: BigInt(0),
	});

	// Ensure recovery code exists (first 2FA credential)
	const recoveryCode = await ensureRecoveryCode(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
	});

	writeAuditLog(
		session.userId,
		"security_key_register",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialName: credName,
		}
	);

	return { success: true, ...(recoveryCode ? { recoveryCode } : {}) };
}

// ─── Credential deletion ───────────────────────────────────────────────────────

export async function deletePasskeyAction(credentialId: string): Promise<SetupResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: passkey deletion
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:delete:${session.userId}`,
		rateLimits.webauthnDelete.limit,
		rateLimits.webauthnDelete.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const deleted = await deleteUserPasskeyCredential(session.userId, decodeBase64(credentialId));
	if (!deleted) return { error: "Credential not found." };
	const { clearRecoveryCodeIfNo2FA } = await import("@/lib/auth/2fa");
	await clearRecoveryCodeIfNo2FA(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
	});

	writeAuditLog(
		session.userId,
		"passkey_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialId,
		}
	);

	return { success: true };
}

export async function deleteSecurityKeyAction(credentialId: string): Promise<SetupResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	// Rate limit: security key deletion
	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:delete:${session.userId}`,
		rateLimits.webauthnDelete.limit,
		rateLimits.webauthnDelete.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const deleted = await deleteUserSecurityKeyCredential(session.userId, decodeBase64(credentialId));
	if (!deleted) return { error: "Credential not found." };
	const { clearRecoveryCodeIfNo2FA } = await import("@/lib/auth/2fa");
	await clearRecoveryCodeIfNo2FA(session.userId);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_disabled",
	});

	writeAuditLog(
		session.userId,
		"security_key_remove",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{
			credentialId,
		}
	);

	return { success: true };
}

// ─── List credentials ──────────────────────────────────────────────────────────

export interface CredentialInfo {
	id: string;
	name: string;
	createdAt?: string;
}

export async function listPasskeysAction(): Promise<CredentialInfo[]> {
	const { session } = await getCurrentSession();
	if (!session) return [];
	const creds = await getUserPasskeyCredentials(session.userId);
	return creds.map((c) => ({ id: encodeBase64(c.id), name: c.name }));
}

export async function listSecurityKeysAction(): Promise<CredentialInfo[]> {
	const { session } = await getCurrentSession();
	if (!session) return [];
	const creds = await getUserSecurityKeyCredentials(session.userId);
	return creds.map((c) => ({ id: encodeBase64(c.id), name: c.name }));
}
