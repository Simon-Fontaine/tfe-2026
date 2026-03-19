import { timingSafeEqual } from "node:crypto";

/** Timing-safe string comparison (prevents side-channel attacks). */
export function timingSafeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	return timingSafeEqual(bufA, bufB);
}

/** Generates random numeric code using rejection sampling. */
export function generateNumericCode(length = 6): string {
	const digits: number[] = [];
	while (digits.length < length) {
		const bytes = new Uint8Array(length - digits.length);
		crypto.getRandomValues(bytes);
		for (const b of bytes) {
			// Reject values 250-255 to eliminate modulo bias
			if (b < 250 && digits.length < length) {
				digits.push(b % 10);
			}
		}
	}
	return digits.join("");
}
