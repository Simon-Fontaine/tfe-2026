// ─── Auth step types ────────────────────────────────────────────────────────

export type AuthStep =
	| "login"
	| "register"
	| "forgot-password"
	| "forgot-password-sent"
	| "verify-email"
	| "new-device-verification"
	| "two-factor"
	| "recovery-code"
	| "reset-password";

// ─── Two-factor ─────────────────────────────────────────────────────────────

export type TwoFactorMethods = {
	totp: boolean;
	passkey: boolean;
	securityKey: boolean;
	passkeyCredentialIds?: string[];
	securityKeyCredentialIds?: string[];
};

// ─── Action result ──────────────────────────────────────────────────────────

export type ActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	nextStep?: AuthStep;
	email?: string;
	next?: string;
	twoFactorMethods?: TwoFactorMethods;
	newRecoveryCode?: string;
	redirect?: string;
};

// ─── Session ────────────────────────────────────────────────────────────────

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

// ─── Client context ─────────────────────────────────────────────────────────

export interface ClientContext {
	ip: string | null;
	userAgent: string | null;
	fingerprint: string;
	deviceName: string;
	browserName: string | null;
	osName: string | null;
	deviceType: "mobile" | "tablet" | "desktop" | null;
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

export interface RateLimitResult {
	allowed: boolean;
	retryAfterMs: number;
}

export interface RateLimitRule {
	limit: number;
	windowMs: number;
}

// ─── API response types ─────────────────────────────────────────────────────

export type ApiSuccessResponse<T = unknown> = {
	data: T;
};

export type ApiErrorResponse = {
	error: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

// ─── Headers interface ──────────────────────────────────────────────────────

/** Minimal header getter used by extractClientContext and other framework-agnostic code. */
export interface HeadersGetter {
	get(name: string): string | null;
}
