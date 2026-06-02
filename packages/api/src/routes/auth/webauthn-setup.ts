import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import {
	ClientDataType,
	coseAlgorithmES256,
	coseAlgorithmRS256,
	parseAttestationObject,
	parseClientDataJSON,
} from "@oslojs/webauthn";
import { rateLimits } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { generateRecoveryCode } from "@/auth/2fa";
import { writeAuditLog } from "@/auth/audit";
import { sendSecurityAlertEmail } from "@/auth/email-security";
import {
	createPasskeyCredential,
	createSecurityKeyCredential,
	createWebAuthnChallenge,
	decodeCOSEMapWithSize,
	getUserPasskeyCredentials,
	getUserSecurityKeyCredentials,
	verifyWebAuthnChallenge,
} from "@/auth/webauthn";
import { encryptStringToText } from "@/crypto/encryption";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { type AuthEnv, requireAuth } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { fetchGeoData } from "@/utils/geo";

interface AttestationData {
	credentialId: string;
	attestationObject: string;
	clientDataJSON: string;
}

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
const SUPPORTED_ALGORITHMS = new Set([coseAlgorithmES256, coseAlgorithmRS256]);

async function ensureRecoveryCode(userId: string): Promise<string | null> {
	const user = await db
		.select({ recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (user?.recoveryCode) return null;

	const code = generateRecoveryCode();
	const encrypted = encryptStringToText(code);
	await db.update(userTable).set({ recoveryCode: encrypted }).where(eq(userTable.id, userId));
	return code;
}

function extractPublicKeyBytesFromAuthData(attestationObjectBytes: Uint8Array): Uint8Array {
	const authDataBytes = extractRawAuthData(attestationObjectBytes);

	const flags = authDataBytes[32];
	if (flags === undefined) throw new Error("Auth data too short");
	if ((flags & 0x40) === 0) throw new Error("No attested credential data in auth data");

	let offset = 53;

	const credIdLenHigh = authDataBytes[offset];
	const credIdLenLow = authDataBytes[offset + 1];
	if (credIdLenHigh === undefined || credIdLenLow === undefined) {
		throw new Error("Auth data too short for credential ID length");
	}
	offset += 2 + ((credIdLenHigh << 8) | credIdLenLow);

	const coseKeyBytes = authDataBytes.slice(offset);
	const [, size] = decodeCOSEMapWithSize(coseKeyBytes);
	return coseKeyBytes.slice(0, size);
}

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

async function verifyAndExtractRegistration(
	data: AttestationData
): Promise<
	{ error: string } | { credentialId: Uint8Array; publicKeyBytes: Uint8Array; algorithmId: number }
> {
	const attestationObjectBytes = decodeBase64(data.attestationObject);
	const clientDataJSONBytes = decodeBase64(data.clientDataJSON);

	const clientData = parseClientDataJSON(clientDataJSONBytes);
	if (clientData.type !== ClientDataType.Create) return { error: "Invalid credential type." };
	if (clientData.origin !== ORIGIN) return { error: "Invalid origin." };

	const challengeValid = await verifyWebAuthnChallenge(clientData.challenge);
	if (!challengeValid) return { error: "Challenge expired or already used." };

	const attestation = parseAttestationObject(attestationObjectBytes);
	const authData = attestation.authenticatorData;

	if (!authData.verifyRelyingPartyIdHash(RP_ID)) return { error: "Invalid relying party." };
	if (!authData.userPresent) return { error: "User presence not confirmed." };

	const credential = authData.credential;
	if (!credential) return { error: "No credential in attestation data." };

	const pk = credential.publicKey;
	const algorithmId = pk.isAlgorithmDefined() ? pk.algorithm() : coseAlgorithmES256;
	if (!SUPPORTED_ALGORITHMS.has(algorithmId)) {
		return { error: "Unsupported credential algorithm." };
	}

	let publicKeyBytes: Uint8Array;
	try {
		publicKeyBytes = extractPublicKeyBytesFromAuthData(attestationObjectBytes);
	} catch {
		return { error: "Failed to extract public key." };
	}

	return { credentialId: credential.id, publicKeyBytes, algorithmId };
}

const webauthnSetupRoutes = new Hono<RequestContextEnv & AuthEnv>();
webauthnSetupRoutes.use("*", requireAuth);

// POST /challenge — Generate attestation challenge for registration
webauthnSetupRoutes.post("/challenge", async (c) => {
	const challenge = await createWebAuthnChallenge();
	return c.json({ challenge: encodeBase64(challenge) });
});

// POST /passkey/register — Register a passkey
webauthnSetupRoutes.post("/passkey/register", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:register:${session.userId}`,
		rateLimits.webauthnRegister.limit,
		rateLimits.webauthnRegister.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<AttestationData & { name?: string }>().catch(() => null);
	if (!body) return c.json({ error: "Invalid credential data." }, 400);

	const credName = body.name?.trim() || "My Passkey";
	const result = await verifyAndExtractRegistration(body);
	if ("error" in result) return c.json({ error: result.error }, 400);

	await createPasskeyCredential({
		id: result.credentialId,
		userId: session.userId,
		name: credName,
		algorithmId: result.algorithmId,
		publicKey: result.publicKeyBytes,
		signCount: BigInt(0),
	});

	const recoveryCode = await ensureRecoveryCode(session.userId);
	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
		twoFactorMethod: "passkey",
	});

	writeAuditLog(
		session.userId,
		"passkey_register",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ credentialName: credName }
	);

	return c.json({ success: true, ...(recoveryCode ? { recoveryCode } : {}) });
});

// POST /security-key/register — Register a security key
webauthnSetupRoutes.post("/security-key/register", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`webauthn:register:${session.userId}`,
		rateLimits.webauthnRegister.limit,
		rateLimits.webauthnRegister.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<AttestationData & { name?: string }>().catch(() => null);
	if (!body) return c.json({ error: "Invalid credential data." }, 400);

	const credName = body.name?.trim() || "My Security Key";
	const result = await verifyAndExtractRegistration(body);
	if ("error" in result) return c.json({ error: result.error }, 400);

	await createSecurityKeyCredential({
		id: result.credentialId,
		userId: session.userId,
		name: credName,
		algorithmId: result.algorithmId,
		publicKey: result.publicKeyBytes,
		signCount: BigInt(0),
	});

	const recoveryCode = await ensureRecoveryCode(session.userId);
	const client = c.get("client");
	const geo = await fetchGeoData(client.ip);

	await sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: "two_factor_enabled",
		twoFactorMethod: "security_key",
	});

	writeAuditLog(
		session.userId,
		"security_key_register",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ credentialName: credName }
	);

	return c.json({ success: true, ...(recoveryCode ? { recoveryCode } : {}) });
});

// GET /passkeys — List passkey credentials
webauthnSetupRoutes.get("/passkeys", async (c) => {
	const session = c.get("session");
	const creds = await getUserPasskeyCredentials(session.userId);
	return c.json({ data: creds.map((cred) => ({ id: encodeBase64(cred.id), name: cred.name })) });
});

// GET /security-keys — List security key credentials
webauthnSetupRoutes.get("/security-keys", async (c) => {
	const session = c.get("session");
	const creds = await getUserSecurityKeyCredentials(session.userId);
	return c.json({ data: creds.map((cred) => ({ id: encodeBase64(cred.id), name: cred.name })) });
});

export { webauthnSetupRoutes };
