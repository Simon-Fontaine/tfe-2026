import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { emailVerificationRequestTable } from "@/db/schema";
import { generateNumericCode } from "@/lib/crypto";

const EXPIRY_MS = 1_000 * 60 * 15; // 15 minutes

/** Upserts email verification request and returns 6-digit code. */
export async function createEmailVerificationRequest(
	userId: string,
	email: string,
	ipAddress: string | null
): Promise<string> {
	const code = generateNumericCode(6);
	const expiresAt = new Date(Date.now() + EXPIRY_MS);

	await db
		.delete(emailVerificationRequestTable)
		.where(eq(emailVerificationRequestTable.userId, userId));

	await db
		.insert(emailVerificationRequestTable)
		.values({ userId, email, code, expiresAt, ipAddress });

	return code;
}

/** Fetches active verification request. */
export async function getActiveVerificationRequest(userId: string) {
	return db.query.emailVerificationRequestTable.findFirst({
		where: and(
			eq(emailVerificationRequestTable.userId, userId),
			gt(emailVerificationRequestTable.expiresAt, new Date())
		),
	});
}

/** Deletes user verification requests. */
export async function deleteVerificationRequests(userId: string): Promise<void> {
	await db
		.delete(emailVerificationRequestTable)
		.where(eq(emailVerificationRequestTable.userId, userId));
}
