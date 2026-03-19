import { decodeBase64, encodeBase64, encodeHexLowerCase } from "@oslojs/encoding";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { passkeyCredentialTable, securityKeyCredentialTable } from "@/db/schema";
import logger from "@/lib/logger";
import redis from "@/lib/redis";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WebAuthnUserCredential {
	id: Uint8Array;
	userId: string;
	name: string;
	algorithmId: number;
	publicKey: Uint8Array;
	signCount: bigint;
}

type CredentialRow = {
	id: string;
	userId: string;
	name: string;
	algorithm: number;
	publicKey: string;
	signCount: bigint;
};

function rowToCredential(row: CredentialRow): WebAuthnUserCredential {
	return {
		id: decodeBase64(row.id),
		userId: row.userId,
		name: row.name,
		algorithmId: row.algorithm,
		publicKey: decodeBase64(row.publicKey),
		signCount: row.signCount,
	};
}

// ─── Challenge management ──────────────────────────────────────────────────────

const CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes
const CHALLENGE_TTL_MS = CHALLENGE_TTL_SECONDS * 1000;

// In-memory Redis fallback.
const challengeFallback = new Map<string, number>();

// Periodic sweep for expired fallback challenges.
setInterval(() => {
	const now = Date.now();
	for (const [key, expiresAt] of challengeFallback) {
		if (now >= expiresAt) challengeFallback.delete(key);
	}
}, 60_000).unref();

async function storeChallenge(encoded: string): Promise<void> {
	if (redis) {
		try {
			await redis.set(`webauthn:challenge:${encoded}`, "1", "EX", CHALLENGE_TTL_SECONDS);
			return;
		} catch (err) {
			logger.warn({ err }, "webauthn redis store error, using in-memory fallback");
		}
	}
	challengeFallback.set(encoded, Date.now() + CHALLENGE_TTL_MS);
}

async function consumeChallenge(encoded: string): Promise<boolean> {
	if (redis) {
		try {
			const deleted = await redis.del(`webauthn:challenge:${encoded}`);
			return deleted === 1;
		} catch (err) {
			logger.warn({ err }, "webauthn redis consume error, using in-memory fallback");
		}
	}
	const expiresAt = challengeFallback.get(encoded);
	if (expiresAt === undefined) return false;
	challengeFallback.delete(encoded);
	return Date.now() < expiresAt;
}

export async function createWebAuthnChallenge(): Promise<Uint8Array> {
	const challenge = new Uint8Array(20);
	crypto.getRandomValues(challenge);
	await storeChallenge(encodeHexLowerCase(challenge));
	return challenge;
}

export async function verifyWebAuthnChallenge(challenge: Uint8Array): Promise<boolean> {
	return consumeChallenge(encodeHexLowerCase(challenge));
}

// ─── Passkey credential operations ─────────────────────────────────────────────

export async function getUserPasskeyCredentials(userId: string): Promise<WebAuthnUserCredential[]> {
	const rows = await db
		.select()
		.from(passkeyCredentialTable)
		.where(eq(passkeyCredentialTable.userId, userId));
	return rows.map(rowToCredential);
}

/** Looks up a passkey for discoverable login. */
export async function getPasskeyCredential(
	credentialId: Uint8Array
): Promise<WebAuthnUserCredential | null> {
	const row = await db
		.select()
		.from(passkeyCredentialTable)
		.where(eq(passkeyCredentialTable.id, encodeBase64(credentialId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return row ? rowToCredential(row) : null;
}

export async function getUserPasskeyCredential(
	userId: string,
	credentialId: Uint8Array
): Promise<WebAuthnUserCredential | null> {
	const row = await db
		.select()
		.from(passkeyCredentialTable)
		.where(
			and(
				eq(passkeyCredentialTable.id, encodeBase64(credentialId)),
				eq(passkeyCredentialTable.userId, userId)
			)
		)
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return row ? rowToCredential(row) : null;
}

export async function createPasskeyCredential(credential: WebAuthnUserCredential): Promise<void> {
	await db.insert(passkeyCredentialTable).values({
		id: encodeBase64(credential.id),
		userId: credential.userId,
		name: credential.name,
		algorithm: credential.algorithmId,
		publicKey: encodeBase64(credential.publicKey),
	});
}

export async function deleteUserPasskeyCredential(
	userId: string,
	credentialId: Uint8Array
): Promise<boolean> {
	const deleted = await db
		.delete(passkeyCredentialTable)
		.where(
			and(
				eq(passkeyCredentialTable.id, encodeBase64(credentialId)),
				eq(passkeyCredentialTable.userId, userId)
			)
		)
		.returning({ id: passkeyCredentialTable.id });
	return deleted.length > 0;
}

/** Atomically updates sign count after successful assertion. */
export async function updatePasskeySignCount(
	userId: string,
	credentialId: Uint8Array,
	newSignCount: bigint
): Promise<void> {
	await db
		.update(passkeyCredentialTable)
		.set({ signCount: newSignCount })
		.where(
			and(
				eq(passkeyCredentialTable.id, encodeBase64(credentialId)),
				eq(passkeyCredentialTable.userId, userId)
			)
		);
}

// ─── Security key credential operations ────────────────────────────────────────

export async function getUserSecurityKeyCredentials(
	userId: string
): Promise<WebAuthnUserCredential[]> {
	const rows = await db
		.select()
		.from(securityKeyCredentialTable)
		.where(eq(securityKeyCredentialTable.userId, userId));
	return rows.map(rowToCredential);
}

export async function getUserSecurityKeyCredential(
	userId: string,
	credentialId: Uint8Array
): Promise<WebAuthnUserCredential | null> {
	const row = await db
		.select()
		.from(securityKeyCredentialTable)
		.where(
			and(
				eq(securityKeyCredentialTable.id, encodeBase64(credentialId)),
				eq(securityKeyCredentialTable.userId, userId)
			)
		)
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return row ? rowToCredential(row) : null;
}

export async function createSecurityKeyCredential(
	credential: WebAuthnUserCredential
): Promise<void> {
	await db.insert(securityKeyCredentialTable).values({
		id: encodeBase64(credential.id),
		userId: credential.userId,
		name: credential.name,
		algorithm: credential.algorithmId,
		publicKey: encodeBase64(credential.publicKey),
	});
}

export async function deleteUserSecurityKeyCredential(
	userId: string,
	credentialId: Uint8Array
): Promise<boolean> {
	const deleted = await db
		.delete(securityKeyCredentialTable)
		.where(
			and(
				eq(securityKeyCredentialTable.id, encodeBase64(credentialId)),
				eq(securityKeyCredentialTable.userId, userId)
			)
		)
		.returning({ id: securityKeyCredentialTable.id });
	return deleted.length > 0;
}

/** Atomically updates sign count after successful assertion. */
export async function updateSecurityKeySignCount(
	userId: string,
	credentialId: Uint8Array,
	newSignCount: bigint
): Promise<void> {
	await db
		.update(securityKeyCredentialTable)
		.set({ signCount: newSignCount })
		.where(
			and(
				eq(securityKeyCredentialTable.id, encodeBase64(credentialId)),
				eq(securityKeyCredentialTable.userId, userId)
			)
		);
}

// ─── Signature verification ────────────────────────────────────────────────────

const COSE_ALG_ES256 = -7;
const COSE_ALG_RS256 = -257;
const COSE_KTY_EC2 = 2;
const COSE_KTY_RSA = 3;
const COSE_KEY_KTY = 1;
const COSE_EC2_X = -2;
const COSE_EC2_Y = -3;
const COSE_RSA_N = -1;
const COSE_RSA_E = -2;

/** Verifies an ES256 or RS256 WebAuthn signature. */
export async function verifyWebAuthnSignature(
	publicKeyBytes: Uint8Array,
	algorithmId: number,
	signatureMessage: Uint8Array,
	signature: Uint8Array
): Promise<boolean> {
	try {
		const [coseMap] = decodeCOSEMapWithSize(publicKeyBytes);
		const kty = coseMap.get(COSE_KEY_KTY) as number;

		if (algorithmId === COSE_ALG_ES256 && kty === COSE_KTY_EC2) {
			return await verifyES256(coseMap, signatureMessage, signature);
		}

		if (algorithmId === COSE_ALG_RS256 && kty === COSE_KTY_RSA) {
			return await verifyRS256(coseMap, signatureMessage, signature);
		}

		logger.warn({ algorithmId, kty }, "webauthn: unsupported algorithm/key type combination");
		return false;
	} catch (err) {
		logger.warn({ err }, "webauthn: signature verification error");
		return false;
	}
}

/**
 * Converts a DER-encoded signature to IEEE P1363 format (r || s).
 * Required because WebCrypto expects P1363 instead of DER.
 */
function derToP1363(der: Uint8Array, componentLength: number): Uint8Array {
	// DER structure: 0x30 <totalLen> 0x02 <rLen> <r> 0x02 <sLen> <s>
	let offset = 0;

	if (der[offset++] !== 0x30) throw new Error("Invalid DER signature: expected SEQUENCE");
	// Skip total length
	const totalLen = der[offset++];
	if (totalLen === undefined) throw new Error("Invalid DER signature: truncated");
	// Handle long-form length
	if (totalLen === 0x81) offset++; // skip the extra length byte

	function readInteger(): Uint8Array {
		if (der[offset++] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER");
		const len = der[offset++] ?? 0;
		const value = der.slice(offset, offset + len);
		offset += len;
		return value;
	}

	const r = readInteger();
	const s = readInteger();

	// Pad to component length
	function padToLength(src: Uint8Array, targetLen: number): Uint8Array {
		if (src.length === targetLen) return src;
		if (src.length > targetLen) {
			// Strip sign padding
			return src.slice(src.length - targetLen);
		}
		const padded = new Uint8Array(targetLen);
		padded.set(src, targetLen - src.length);
		return padded;
	}

	const result = new Uint8Array(componentLength * 2);
	result.set(padToLength(r, componentLength), 0);
	result.set(padToLength(s, componentLength), componentLength);
	return result;
}

async function verifyES256(
	coseMap: Map<number, unknown>,
	message: Uint8Array,
	signature: Uint8Array
): Promise<boolean> {
	const x = coseMap.get(COSE_EC2_X) as Uint8Array;
	const y = coseMap.get(COSE_EC2_Y) as Uint8Array;
	if (!x || !y || x.length !== 32 || y.length !== 32) return false;

	const jwk: JsonWebKey = {
		kty: "EC",
		crv: "P-256",
		x: uint8ToBase64Url(x),
		y: uint8ToBase64Url(y),
	};

	const key = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["verify"]
	);

	const p1363Sig = derToP1363(signature, 32);

	return crypto.subtle.verify(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		p1363Sig.buffer as ArrayBuffer,
		message.buffer as ArrayBuffer
	);
}

async function verifyRS256(
	coseMap: Map<number, unknown>,
	message: Uint8Array,
	signature: Uint8Array
): Promise<boolean> {
	const n = coseMap.get(COSE_RSA_N) as Uint8Array;
	const e = coseMap.get(COSE_RSA_E) as Uint8Array;
	if (!n || !e) return false;

	const jwk: JsonWebKey = {
		kty: "RSA",
		n: uint8ToBase64Url(n),
		e: uint8ToBase64Url(e),
	};

	const key = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"]
	);

	return crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		signature.buffer as ArrayBuffer,
		message.buffer as ArrayBuffer
	);
}

function uint8ToBase64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64url");
}

// ─── Minimal CBOR decoder for COSE key maps ──────────────────────────────────

/**
 * Decodes a COSE key map from raw CBOR bytes.
 * Returns bytes consumed to slice authenticator data accurately.
 */
export function decodeCOSEMapWithSize(data: Uint8Array): [Map<number, unknown>, number] {
	let offset = 0;

	function peek(off: number): number {
		const val = data[off];
		if (val === undefined) throw new Error("Unexpected end of CBOR data");
		return val;
	}

	function readByte(): number {
		return peek(offset++);
	}

	function ensureRemaining(n: number): void {
		if (offset + n > data.length) {
			throw new Error(
				`CBOR: need ${n} bytes at offset ${offset}, but only ${data.length - offset} remain`
			);
		}
	}

	function readUint(additionalInfo: number): number {
		if (additionalInfo < 24) return additionalInfo;
		if (additionalInfo === 24) {
			ensureRemaining(1);
			return readByte();
		}
		if (additionalInfo === 25) {
			ensureRemaining(2);
			const val = (peek(offset) << 8) | peek(offset + 1);
			offset += 2;
			return val;
		}
		if (additionalInfo === 26) {
			ensureRemaining(4);
			const val =
				(peek(offset) << 24) |
				(peek(offset + 1) << 16) |
				(peek(offset + 2) << 8) |
				peek(offset + 3);
			offset += 4;
			return val >>> 0; // unsigned
		}
		throw new Error("Unsupported CBOR integer size");
	}

	function readValue(): unknown {
		const initial = readByte();
		const majorType = initial >> 5;
		const additionalInfo = initial & 0x1f;

		switch (majorType) {
			case 0: // unsigned integer
				return readUint(additionalInfo);
			case 1: // negative integer
				return -1 - readUint(additionalInfo);
			case 2: {
				// byte string
				const len = readUint(additionalInfo);
				ensureRemaining(len);
				const bytes = data.slice(offset, offset + len);
				offset += len;
				return bytes;
			}
			case 3: {
				// text string
				const len = readUint(additionalInfo);
				ensureRemaining(len);
				const text = new TextDecoder().decode(data.slice(offset, offset + len));
				offset += len;
				return text;
			}
			case 5: {
				// map
				const mapLen = readUint(additionalInfo);
				const map = new Map<number, unknown>();
				for (let i = 0; i < mapLen; i++) {
					const key = readValue() as number;
					const val = readValue();
					map.set(key, val);
				}
				return map;
			}
			default:
				throw new Error(`Unsupported CBOR major type: ${majorType}`);
		}
	}

	const result = readValue();
	if (!(result instanceof Map)) throw new Error("Expected CBOR map");
	return [result as Map<number, unknown>, offset];
}
