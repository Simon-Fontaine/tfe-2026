import { createCipheriv, createDecipheriv } from "node:crypto";
import { DynamicBuffer } from "@oslojs/binary";
import { decodeBase64, encodeBase64 } from "@oslojs/encoding";

const encryptionKeyBase64 = process.env.ENCRYPTION_KEY;

if (!encryptionKeyBase64) {
	throw new Error("ENCRYPTION_KEY is not defined in the environment variables.");
}

const key = decodeBase64(encryptionKeyBase64);

if (key.byteLength !== 16) {
	throw new Error("ENCRYPTION_KEY must be a 16-byte key encoded as base64 (for AES-128-GCM).");
}

// ─── Core byte-level encrypt / decrypt ─────────────────────────────────────────

/** Encrypts raw bytes using AES-128-GCM. */
function encrypt(data: Uint8Array): Uint8Array {
	const iv = new Uint8Array(16);
	crypto.getRandomValues(iv);

	const cipher = createCipheriv("aes-128-gcm", key, iv);
	const out = new DynamicBuffer(0);
	out.write(iv);
	out.write(cipher.update(data));
	out.write(cipher.final());
	out.write(cipher.getAuthTag());
	return out.bytes();
}

/** Decrypts AES-128-GCM payload. */
function decrypt(encrypted: Uint8Array): Uint8Array {
	if (encrypted.byteLength < 33) {
		throw new Error("Invalid ciphertext: too short.");
	}

	const decipher = createDecipheriv("aes-128-gcm", key, encrypted.slice(0, 16));
	decipher.setAuthTag(encrypted.slice(encrypted.byteLength - 16));

	const out = new DynamicBuffer(0);
	out.write(decipher.update(encrypted.slice(16, encrypted.byteLength - 16)));
	out.write(decipher.final());
	return out.bytes();
}

// ─── Text column helpers ───────────────────────────────────────────────────────

/** Encrypts bytes to base64 string. */
export function encryptToText(data: Uint8Array): string {
	return encodeBase64(encrypt(data));
}

/** Decrypts base64 string to bytes. */
export function decryptFromText(encoded: string): Uint8Array {
	return decrypt(decodeBase64(encoded));
}

/** Encrypts UTF-8 string to base64. */
export function encryptStringToText(data: string): string {
	return encryptToText(new TextEncoder().encode(data));
}

/** Decrypts base64 to UTF-8 string. */
export function decryptTextToString(encoded: string): string {
	return new TextDecoder().decode(decryptFromText(encoded));
}
