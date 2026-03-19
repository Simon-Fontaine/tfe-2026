import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { type sessionRevocationReasonEnum, sessionTable, userTable } from "@/db/schema";
import { getUserTwoFactorStatus } from "./2fa";

// ─── Constants ─────────────────────────────────────────────────────────────────

const SESSION_DURATION_MS = 1_000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD_MS = 1_000 * 60 * 60 * 24 * 15;
const LAST_ACTIVE_THROTTLE_MS = 1_000 * 60 * 5;

// ─── Types ───────────────────────────────────────────────────────────────────

export type RevocationReason = (typeof sessionRevocationReasonEnum.enumValues)[number];

export interface SessionFlags {
	twoFactorVerified: boolean;
}

/** Optional session creation metadata. */
export interface SessionMetadata {
	ipAddress?: string | null;
	userAgent?: string | null;
	/** FK to userDeviceTable.id. */
	deviceId?: string | null;
	/** ISO 3166-1 alpha-2. */
	geoCountry?: string | null;
	geoCity?: string | null;
	geoLat?: string | null;
	geoLon?: string | null;
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
	avatarUrl: string | null;
	emailVerified: boolean;
	isBanned: boolean;
	registeredTOTP: boolean;
	registeredPasskey: boolean;
	registeredSecurityKey: boolean;
	registered2FA: boolean;
}

export type SessionValidationResult =
	| { session: Session; user: SessionUser }
	| { session: null; user: null };

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Hash token to session ID. */
function tokenToSessionId(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

// ─── Token + session creation ────────────────────────────────────────────────

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(
	token: string,
	userId: string,
	flags: SessionFlags,
	metadata?: SessionMetadata
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
		ipAddress: metadata?.ipAddress ?? null,
		userAgent: metadata?.userAgent ?? null,
		deviceId: metadata?.deviceId ?? null,
		geoCountry: metadata?.geoCountry ?? null,
		geoCity: metadata?.geoCity ?? null,
		geoLat: metadata?.geoLat ?? null,
		geoLon: metadata?.geoLon ?? null,
	});

	return session;
}

// ─── Session validation ──────────────────────────────────────────────────────

/** Validates session and handles rolling renewal. */
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

	const twoFactor = await getUserTwoFactorStatus(u.id);

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
			avatarUrl: u.avatarUrl,
			emailVerified: u.emailVerified,
			isBanned: u.isBanned,
			...twoFactor,
		},
	};
}

/** Request-memoized current session. */
export const getCurrentSession = cache(async (): Promise<SessionValidationResult> => {
	const cookieStore = await cookies();
	const token = cookieStore.get("session_token")?.value ?? null;
	if (!token) return { session: null, user: null };
	return validateSessionToken(token);
});

// ─── Session revocation ──────────────────────────────────────────────────────

/** Soft-revokes a session. */
export async function invalidateSession(
	sessionId: string,
	reason: RevocationReason = "manual_logout"
): Promise<void> {
	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: reason })
		.where(eq(sessionTable.id, sessionId));
}

export async function invalidateUserSessions(
	userId: string,
	reason: RevocationReason = "logout_all_devices"
): Promise<void> {
	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: reason })
		.where(and(eq(sessionTable.userId, userId), isNull(sessionTable.revokedAt)));
}

export async function setSessionAs2FAVerified(sessionId: string): Promise<void> {
	await db
		.update(sessionTable)
		.set({ twoFactorVerified: true })
		.where(eq(sessionTable.id, sessionId));
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

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
