import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import {
	passkeyCredentialTable,
	securityKeyCredentialTable,
	type sessionRevocationReasonEnum,
	sessionTable,
	totpCredentialTable,
	userTable,
} from "@/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_DURATION_MS = 1_000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD_MS = 1_000 * 60 * 60 * 24 * 15; // renew if < 15 days left
const LAST_ACTIVE_THROTTLE_MS = 1_000 * 60 * 5; // write at most once per 5 min

// ─── Types ────────────────────────────────────────────────────────────────────

export type RevocationReason = (typeof sessionRevocationReasonEnum.enumValues)[number];

export interface SessionFlags {
	twoFactorVerified: boolean;
}

export interface Session extends SessionFlags {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface SessionUser {
	id: string;
	email: string;
	username: string;
	displayName: string;
	emailVerified: boolean;
	isBanned: boolean;
	registeredTOTP: boolean;
	registeredPasskey: boolean;
	registeredSecurityKey: boolean;
	/** true if any 2FA method is registered */
	registered2FA: boolean;
}

export type SessionValidationResult =
	| { session: Session; user: SessionUser }
	| { session: null; user: null };

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Derives the session ID (stored in DB) from the raw bearer token (sent to client). */
function tokenToSessionId(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

// ─── Token + session creation ─────────────────────────────────────────────────

/** Generates a cryptographically-secure 20-byte session token (base32, no padding). */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(
	token: string,
	userId: string,
	flags: SessionFlags
): Promise<Session> {
	const session: Session = {
		id: tokenToSessionId(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
		twoFactorVerified: flags.twoFactorVerified,
	};

	await db.insert(sessionTable).values({
		id: session.id,
		userId: session.userId,
		expiresAt: session.expiresAt,
		twoFactorVerified: session.twoFactorVerified,
	});

	return session;
}

// ─── Session validation ───────────────────────────────────────────────────────

/** Validates a raw session token, handles rolling renewal and lastActiveAt throttling, and returns the session and user. */
export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
	const sessionId = tokenToSessionId(token);

	const row = await db
		.select()
		.from(sessionTable)
		.innerJoin(userTable, eq(sessionTable.userId, userTable.id))
		.where(eq(sessionTable.id, sessionId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!row) return { session: null, user: null };

	const { session: s, user: u } = row;

	if (Date.now() >= s.expiresAt.getTime()) return { session: null, user: null };
	if (s.revokedAt !== null) return { session: null, user: null };
	if (u.isBanned) return { session: null, user: null };

	// Batch renewal and lastActiveAt into one UPDATE when possible.

	const now = Date.now();
	const needsRenewal = now >= s.expiresAt.getTime() - SESSION_RENEWAL_THRESHOLD_MS;
	const needsActivityUpdate = now - s.lastActiveAt.getTime() >= LAST_ACTIVE_THROTTLE_MS;
	const renewedExpiresAt = needsRenewal ? new Date(now + SESSION_DURATION_MS) : s.expiresAt;

	if (needsRenewal || needsActivityUpdate) {
		await db
			.update(sessionTable)
			.set({
				...(needsRenewal && { expiresAt: renewedExpiresAt }),
				...(needsActivityUpdate && { lastActiveAt: new Date(now) }),
			})
			.where(eq(sessionTable.id, sessionId));
	}

	// Check all three 2FA credential types in parallel.

	const [totpRows, passkeyRows, securityKeyRows] = await Promise.all([
		db
			.select({ id: totpCredentialTable.id })
			.from(totpCredentialTable)
			.where(eq(totpCredentialTable.userId, u.id))
			.limit(1),
		db
			.select({ id: passkeyCredentialTable.id })
			.from(passkeyCredentialTable)
			.where(eq(passkeyCredentialTable.userId, u.id))
			.limit(1),
		db
			.select({ id: securityKeyCredentialTable.id })
			.from(securityKeyCredentialTable)
			.where(eq(securityKeyCredentialTable.userId, u.id))
			.limit(1),
	]);

	const registeredTOTP = totpRows.length > 0;
	const registeredPasskey = passkeyRows.length > 0;
	const registeredSecurityKey = securityKeyRows.length > 0;

	return {
		session: {
			id: s.id,
			userId: s.userId,
			expiresAt: renewedExpiresAt,
			twoFactorVerified: s.twoFactorVerified,
		},
		user: {
			id: u.id,
			email: u.email,
			username: u.username,
			displayName: u.displayName,
			emailVerified: u.emailVerified,
			isBanned: u.isBanned,
			registeredTOTP,
			registeredPasskey,
			registeredSecurityKey,
			registered2FA: registeredTOTP || registeredPasskey || registeredSecurityKey,
		},
	};
}

/** Returns the current request's session and user. Memoized per request via React's `cache()`. */
export const getCurrentSession = cache(async (): Promise<SessionValidationResult> => {
	const cookieStore = await cookies();
	const token = cookieStore.get("session_token")?.value ?? null;
	if (!token) return { session: null, user: null };
	return validateSessionToken(token);
});

// ─── Session revocation ───────────────────────────────────────────────────────

/** Soft-revokes a single session. The row is preserved for audit. */
export async function invalidateSession(
	sessionId: string,
	reason: RevocationReason = "manual_logout"
): Promise<void> {
	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: reason })
		.where(eq(sessionTable.id, sessionId));
}

/** Soft-revokes all active sessions for a user. */
export async function invalidateUserSessions(
	userId: string,
	reason: RevocationReason = "logout_all_devices"
): Promise<void> {
	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: reason })
		.where(and(eq(sessionTable.userId, userId), isNull(sessionTable.revokedAt)));
}

/** Marks a session as having passed 2FA verification. */
export async function setSessionAs2FAVerified(sessionId: string): Promise<void> {
	await db
		.update(sessionTable)
		.set({ twoFactorVerified: true })
		.where(eq(sessionTable.id, sessionId));
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export async function setSessionTokenCookie(token: string, expiresAt: Date): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set("session_token", token, {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		expires: expiresAt,
	});
}

export async function deleteSessionTokenCookie(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set("session_token", "", {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0,
	});
}
