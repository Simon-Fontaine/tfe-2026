import { cookies } from "next/headers";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionFlags {
	twoFactorVerified: boolean;
}

export interface SessionMetadata {
	ipAddress?: string | null;
	userAgent?: string | null;
	deviceId?: string | null;
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

// ─── Session query ──────────────────────────────────────────────────────────

/** Request-memoized current session via API. */
export const getCurrentSession = cache(async (): Promise<SessionValidationResult> => {
	const res = await apiGet<{ session: Session | null; user: SessionUser | null }>(
		"/api/auth/session"
	);
	if ("data" in res && res.data.session && res.data.user) {
		return { session: res.data.session, user: res.data.user };
	}
	return { session: null, user: null };
});

// ─── Cookie helpers ─────────────────────────────────────────────────────────

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
