import { hash, verify } from "@node-rs/argon2";
import { sha1 } from "@oslojs/crypto/sha1";
import { encodeHexLowerCase } from "@oslojs/encoding";

// ─── Hashing ──────────────────────────────────────────────────────────────────

/** Hashes a plaintext password using Argon2id with OWASP-recommended parameters. */
export async function hashPassword(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

/** Returns true if `password` matches the stored `hash`. */
export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
	return verify(hash, password);
}

// ─── Pwned password check ─────────────────────────────────────────────────────

/**
 * Returns false if the password appears in the Have I Been Pwned database; true otherwise.
 *
 * Uses k-anonymity: only the first 5 hex characters of the SHA-1 hash are
 * sent to the HIBP API, so the full hash (and the password itself) is never
 * transmitted.
 */
export async function verifyPasswordStrength(password: string): Promise<boolean> {
	const sha1Hash = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
	const prefix = sha1Hash.slice(0, 5);
	const suffix = sha1Hash.slice(5);

	const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);

	if (!response.ok) {
		// Fail open: don't block the user if HIBP is unreachable.
		return true;
	}

	const text = await response.text();

	for (const line of text.split("\n")) {
		// Each line is "<SUFFIX>:<count>" — suffixes are uppercase in the response.
		if (line.slice(0, 35).toLowerCase() === suffix) {
			return false;
		}
	}

	return true;
}
