import { hash, verify } from "@node-rs/argon2";
import { sha1 } from "@oslojs/crypto/sha1";
import { encodeHexLowerCase } from "@oslojs/encoding";

/** Argon2id with OWASP-recommended parameters. */
export async function hashPassword(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
	return verify(hash, password);
}

/**
 * Checks HIBP via k-anonymity (fails open).
 */
export async function verifyPasswordStrength(password: string): Promise<boolean> {
	const sha1Hash = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
	const prefix = sha1Hash.slice(0, 5);
	const suffix = sha1Hash.slice(5);

	const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);

	if (!response.ok) {
		return true;
	}

	const text = await response.text();

	for (const line of text.split("\n")) {
		// Response format: "<SUFFIX>:<count>"
		if (line.slice(0, 35).toLowerCase() === suffix) {
			return false;
		}
	}

	return true;
}
