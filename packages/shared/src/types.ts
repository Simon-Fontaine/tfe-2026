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
export type OrgPermissionRole = "owner" | "admin" | "member";
export type OrgRole = OrgPermissionRole;
export type TeamPermissionRole = "admin" | "member";
export type MemberType = "player" | "staff";
export type StaffRole = "coach" | "analyst" | "manager" | "staff";
export type InviteLifecycleStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";
export type JoinRequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "cancelled";
export type RecruitmentPostCategory = "lft" | "lfp" | "lfr" | "lfs";
export type RecruitmentOwnerType = "player" | "team" | "organization";
export type RecruitmentPostStatus = "open" | "closed" | "fulfilled" | "expired";
export type RecruitmentResponseStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type UserSearchResult = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	primaryRole: OW2Role | null;
	rank: string | null;
};

// ─── Team types ────────────────────────────────────────────────────────────

export type TeamPermissions = {
	orgRole: OrgPermissionRole | null;
	teamPermissionRole: TeamPermissionRole | null;
	canManage: boolean;
	canManageAdmins: boolean;
	canManageMembers: boolean;
	canManageRoster: boolean;
	canManageInvites: boolean;
	canManagePosts: boolean;
	canManageConversations: boolean;
	canManageRequests: boolean;
	canManageSettings: boolean;
	canLeave: boolean;
};

export type TeamMemberSummary = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	roleInTeam: OW2Role | null;
	primaryRole: OW2Role | null;
	rank: string | null;
	rankDivision: number | null;
	permissionRole: TeamPermissionRole;
	status: RosterStatus;
	joinedAt: IsoDateString;
	leftAt: IsoDateString | null;
	statusChangedAt: IsoDateString;
};

export type RosterMember = TeamMemberSummary;

export type TeamSummary = {
	id: string;
	organizationId: string;
	organizationName: string | null;
	organizationSlug: string | null;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	isArchived: boolean;
	activeRosterCount: number;
	adminCount: number;
};

export type TeamAdminSummary = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	permissionRole: TeamPermissionRole;
	orgRole: OrgPermissionRole | null;
	source: "team" | "organization";
};

export type TeamInviteSummary = {
	id: string;
	teamId: string;
	teamName: string;
	teamTag: string;
	teamAvatarUrl: string | null;
	inviterDisplayName: string;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	roleInTeam: OW2Role | null;
	permissionRole: TeamPermissionRole;
	status: InviteLifecycleStatus;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type TeamPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	roleInTeam: OW2Role | null;
	permissionRole: TeamPermissionRole;
	status: InviteLifecycleStatus;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type TeamJoinRequestSummary = {
	id: string;
	requesterUserId: string;
	requesterDisplayName: string;
	requesterAvatarUrl: string | null;
	requesterPrimaryRole: OW2Role | null;
	requesterRank: string | null;
	requestedRoleInTeam: OW2Role;
	message: string | null;
	status: JoinRequestStatus;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type TeamWorkspaceConversation = RecruitmentConversationSummary;

export type TeamWorkspaceDetail = TeamSummary & {
	currentUser: TeamPermissions;
	members: TeamMemberSummary[];
	players: TeamMemberSummary[];
	staff: TeamMemberSummary[];
	roster: TeamMemberSummary[];
	admins: TeamAdminSummary[];
	pendingInvites: TeamPendingInvite[];
	pendingJoinRequests: TeamJoinRequestSummary[];
	ownedPosts: RecruitmentPostSummary[];
	conversations: TeamWorkspaceConversation[];
	applications: RecruitmentResponseSummary[];
	lfgPosts: RecruitmentPostSummary[];
};

export type TeamWithRoster = TeamWorkspaceDetail;

export type TeamPublicPreview = {
	id: string;
	organizationId: string;
	organizationName: string;
	organizationSlug: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	isArchived: boolean;
	activeRosterCount: number;
	openPostCount: number;
	hasOpenRolePost: boolean;
	hasPendingJoinRequest: boolean;
	posts: RecruitmentPostSummary[];
};

// ─── Organization types ────────────────────────────────────────────────────

export type OrgPermissions = {
	role: OrgPermissionRole | null;
	canManage: boolean;
	canDelete: boolean;
	canTransferOwnership: boolean;
	canLeave: boolean;
	canManageMembers: boolean;
	canManageTeams: boolean;
	canManageInvites: boolean;
	canManageSettings: boolean;
	canReviewRequests: boolean;
};

export type UserOrg = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	description: string | null;
	role: OrgPermissionRole;
	teamCount: number;
	openPostCount: number;
	canManage: boolean;
};

export type OrgTeamSummary = TeamSummary;

export type OrgMemberSummary = {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	permissionRole: OrgPermissionRole;
	role: OrgPermissionRole;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	activeTeamCount: number;
	joinedAt: IsoDateString;
};

export type OrgInviteSummary = {
	id: string;
	organizationId: string;
	orgName: string;
	orgAvatarUrl: string | null;
	inviterDisplayName: string;
	permissionRole: OrgPermissionRole;
	role: OrgPermissionRole;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	status: InviteLifecycleStatus;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type OrgPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	permissionRole: OrgPermissionRole;
	role: OrgPermissionRole;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRole: OW2Role | null;
	status: InviteLifecycleStatus;
	expiresAt: IsoDateString;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type OrgJoinRequestSummary = {
	id: string;
	requesterUserId: string;
	requesterDisplayName: string;
	requesterAvatarUrl: string | null;
	requesterPrimaryRole: OW2Role | null;
	requesterRank: string | null;
	message: string | null;
	status: JoinRequestStatus;
	createdAt: IsoDateString;
	statusChangedAt: IsoDateString;
};

export type OrgWorkspaceDetail = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	description: string | null;
	ownerId: string;
	currentUser: OrgPermissions;
	activeTeams: OrgTeamSummary[];
	archivedTeams: OrgTeamSummary[];
	members: OrgMemberSummary[];
	pendingInvites: OrgPendingInvite[];
	ownedPosts: RecruitmentPostSummary[];
	conversations: RecruitmentConversationSummary[];
	pendingJoinRequests: OrgJoinRequestSummary[];
};

export type OrgWithTeams = OrgWorkspaceDetail;

export type PublicOrgSummary = {
	id: string;
	slug: string;
	name: string;
	avatarUrl: string | null;
	description: string | null;
	teamCount: number;
	activeRosterCount: number;
	openPostCount: number;
};

export type PublicOrgDetail = {
	id: string;
	slug: string;
	name: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	description: string | null;
	teamCount: number;
	activeRosterCount: number;
	teams: OrgTeamSummary[];
	openPosts: RecruitmentPostSummary[];
	hasPendingJoinRequest: boolean;
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
	openPostCount: number;
};

export type DiscoveryFilters = {
	recruiting?: boolean;
};

// ─── Recruitment types ─────────────────────────────────────────────────────

export type RecruitmentPostSummary = {
	id: string;
	category: RecruitmentPostCategory;
	type: RecruitmentPostCategory;
	status: RecruitmentPostStatus;
	ownerType: RecruitmentOwnerType;
	title: string;
	description: string | null;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRoles: OW2Role[];
	rolesNeeded: OW2Role[];
	minRank: string | null;
	maxRank: string | null;
	minSr: number | null;
	maxSr: number | null;
	region: string | null;
	expiresAt: IsoDateString | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	ownerUserId: string;
	userId: string;
	ownerDisplayName: string;
	userDisplayName: string;
	ownerAvatarUrl: string | null;
	userAvatarUrl: string | null;
	organizationId: string | null;
	organizationName: string | null;
	organizationSlug: string | null;
	organizationAvatarUrl: string | null;
	teamId: string | null;
	teamName: string | null;
	teamTag: string | null;
	teamAvatarUrl: string | null;
	teamSr: number | null;
	responseCount: number;
	hasResponded: boolean;
	canManage: boolean;
	canRespond: boolean;
};

export type RecruitmentResponseSummary = {
	id: string;
	postId: string;
	threadId: string | null;
	status: RecruitmentResponseStatus;
	message: string | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	senderType: RecruitmentOwnerType;
	senderUserId: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	senderOrganizationId: string | null;
	senderOrganizationName: string | null;
	senderTeamId: string | null;
	senderTeamName: string | null;
	senderTeamTag: string | null;
	teamName: string | null;
	teamTag: string | null;
	senderMemberType: MemberType;
	senderStaffRole: StaffRole | null;
	senderGameRoles: OW2Role[];
	senderPrimaryRole: OW2Role | null;
	senderRank: string | null;
	applicantUserId: string;
	applicantDisplayName: string;
	applicantAvatarUrl: string | null;
	applicantPrimaryRole: OW2Role | null;
	applicantRank: string | null;
	postCategory: RecruitmentPostCategory;
	postTitle: string;
};

export type RecruitmentConversationSummary = {
	threadId: string;
	responseId: string;
	postId: string;
	postCategory: RecruitmentPostCategory;
	postTitle: string;
	postStatus: RecruitmentPostStatus;
	counterpartLabel: string;
	counterpartAvatarUrl: string | null;
	organizationId: string | null;
	teamId: string | null;
	lastMessagePreview: string | null;
	lastMessageAt: IsoDateString | null;
	unreadCount: number;
};

export type RecruitmentMessage = {
	id: string;
	threadId: string;
	senderId: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	content: string;
	isSystemMessage: boolean;
	createdAt: IsoDateString;
};

export type RecruitmentThreadParticipant = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
};

export type RecruitmentThread = {
	id: string;
	responseId: string;
	post: RecruitmentPostSummary;
	response: RecruitmentResponseSummary;
	participants: RecruitmentThreadParticipant[];
	messages: RecruitmentMessage[];
};

// ─── Legacy LFG aliases ────────────────────────────────────────────────────

export type LfgPostSummary = RecruitmentPostSummary;
export type LfgApplicationSummary = RecruitmentResponseSummary;
export type UserApplicationSummary = RecruitmentResponseSummary;

export type LfgFilters = {
	type?: RecruitmentPostCategory;
	category?: RecruitmentPostCategory;
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

// ─── Public player types ───────────────────────────────────────────────────

export type PublicPlayerSummary = {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	bio: string | null;
	primaryRole: OW2Role | null;
	secondaryRole: OW2Role | null;
	rank: string | null;
	rankDivision: number | null;
	openPosts: RecruitmentPostSummary[];
};

export type PublicPlayerDetail = PublicPlayerSummary & {
	bannerUrl: string | null;
};

// ─── Hero types ────────────────────────────────────────────────────────────

export type HeroRow = {
	id: string;
	displayName: string;
	role: OW2Role;
	imageUrl: string | null;
	description: string | null;
};
