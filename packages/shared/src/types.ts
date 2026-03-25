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
	expiresAt: IsoDateString;
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

// ─── Temporal conventions ───────────────────────────────────────────────────

/**
 * ISO-8601 timestamp string serialized for transport across API/service boundaries.
 * Convention: DTOs use `IsoDateString`; convert to `Date` only after explicit parsing in domain/UI layers.
 */
export type IsoDateString = string;

// ─── Headers interface ──────────────────────────────────────────────────────

/** Minimal header getter used by extractClientContext and other framework-agnostic code. */
export interface HeadersGetter {
	get(name: string): string | null;
}

// ─── Common domain types ───────────────────────────────────────────────────

export type OW2Role = "tank" | "damage" | "support";
export type RosterStatus = "active" | "benched" | "trial" | "inactive";
export type OrgRole = "owner" | "manager" | "coach" | "analyst" | "player";

// ─── Team types ────────────────────────────────────────────────────────────

export type RosterMember = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	primaryRole: OW2Role;
	rank: string | null;
	rankDivision: number | null;
	roleInTeam: OW2Role;
	status: RosterStatus;
	joinedAt: IsoDateString;
};

export type TeamWithRoster = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	roster: RosterMember[];
};

export type TeamPublicPreview = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	activeRosterCount: number;
	hasOpenRolePost: boolean;
};

export type UserSearchResult = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	primaryRole: OW2Role | null;
	rank: string | null;
};

export type TeamInviteSummary = {
	id: string;
	teamId: string;
	teamName: string;
	teamTag: string;
	teamAvatarUrl: string | null;
	inviterDisplayName: string;
	roleInTeam: OW2Role;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
};

export type TeamPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	roleInTeam: OW2Role;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
};

// ─── Organization types ────────────────────────────────────────────────────

export type UserOrg = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	description: string | null;
	role: OrgRole;
	teamCount: number;
};

export type OrgTeamSummary = {
	id: string;
	name: string;
	tag: string;
	avatarUrl: string | null;
	teamSr: number;
	isRecruiting: boolean;
};

export type OrgMemberSummary = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	role: OrgRole;
};

export type OrgWithTeams = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	description: string | null;
	ownerId: string;
	teams: OrgTeamSummary[];
	members: OrgMemberSummary[];
};

export type OrgInviteSummary = {
	id: string;
	organizationId: string;
	orgName: string;
	orgAvatarUrl: string | null;
	inviterDisplayName: string;
	role: OrgRole;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
};

export type OrgPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	role: OrgRole;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
};

// ─── Discovery types ───────────────────────────────────────────────────────

export type DiscoveryTeam = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	isRecruiting: boolean;
	activeRosterCount: number;
};

export type DiscoveryFilters = {
	recruiting?: boolean;
};

// ─── LFG types ─────────────────────────────────────────────────────────────

export type LfgPostSummary = {
	id: string;
	type: "team_seeking_player" | "player_seeking_team";
	status: string;
	rolesNeeded: string[];
	minRank: string | null;
	maxRank: string | null;
	description: string | null;
	region: string | null;
	expiresAt: IsoDateString | null;
	createdAt: IsoDateString;
	userId: string;
	userDisplayName: string;
	userAvatarUrl: string | null;
	teamId: string | null;
	teamName: string | null;
	teamTag: string | null;
	teamAvatarUrl: string | null;
	teamSr: number | null;
};

export type LfgApplicationSummary = {
	id: string;
	postId: string;
	status: string;
	message: string | null;
	createdAt: IsoDateString;
	applicantUserId: string;
	applicantDisplayName: string;
	applicantAvatarUrl: string | null;
	applicantPrimaryRole: string | null;
	applicantRank: string | null;
};

export type UserApplicationSummary = {
	id: string;
	status: string;
	message: string | null;
	createdAt: IsoDateString;
	postId: string;
	teamName: string | null;
	teamTag: string | null;
};

export type LfgFilters = {
	type?: "team_seeking_player" | "player_seeking_team";
	role?: string;
	region?: string;
};

// ─── Notification types ────────────────────────────────────────────────────

export type NotificationSummary = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	referenceType: string | null;
	referenceId: string | null;
	isRead: boolean;
	createdAt: IsoDateString;
};

// ─── Player types ──────────────────────────────────────────────────────────

export type PlayerProfileFull = {
	battletag: string | null;
	primaryRole: OW2Role;
	secondaryRole: OW2Role | null;
	rank: string | null;
	rankDivision: number | null;
	internalSr: number;
	heroes: {
		id: string;
		displayName: string;
		role: OW2Role;
		imageUrl: string | null;
	}[];
};

export type PlayerStats = {
	sr: number;
	scrimsPlayed: number;
	wins: number;
};

export type AvailabilityRow = {
	id: string;
	teamId: string;
	dayOfWeek: number | null;
	specificDate: IsoDateString | null;
	startTime: string;
	endTime: string;
	timezone: string;
	label: string | null;
};

export type UserTeam = {
	id: string;
	name: string;
	tag: string;
};

// ─── Hero types ────────────────────────────────────────────────────────────

export type HeroRow = {
	id: string;
	displayName: string;
	role: OW2Role;
	imageUrl: string | null;
	description: string | null;
};
