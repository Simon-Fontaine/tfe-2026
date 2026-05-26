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

export type DirectUploadIntent = {
	uploadUrl: string;
	uploadMethod: "PUT";
	uploadHeaders: Record<string, string>;
	objectKey: string;
	objectUrl: string;
	expiresAt: IsoDateString;
};

export type FinalizedUpload = {
	objectKey: string;
	url: string;
	contentType: string | null;
	sizeBytes: number | null;
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

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export type OW2Role = "tank" | "damage" | "support";
export type OnboardingStep = "battletag" | "roles-and-rank" | "hero-pool" | "intent" | "complete";
export type ParticipationIntent =
	| "find_team"
	| "recruit_players"
	| "schedule_scrims"
	| "just_browsing";
export type AvailabilityIntent = "weekdays" | "weekends" | "flexible" | "not_sure";
export type ProfileVisibility = "public" | "teams_only" | "private";
export type PlayerRecruitingStatus = "looking" | "unavailable";
export type PrivacyVisibility = ProfileVisibility;
export type NotificationOptionalCategory =
	| "invites"
	| "applications"
	| "scrimChanges"
	| "chatActivity"
	| "results"
	| "disputes"
	| "updates";
export type MandatoryNotificationCategory =
	| "accountLifecycle"
	| "securityCritical"
	| "moderationCritical";
export type NotificationPreferenceSettings = Record<NotificationOptionalCategory, boolean>;
export type MandatoryNotificationPolicy = Record<MandatoryNotificationCategory, true>;
export type PersonalPrivacySettings = {
	profileVisibility: ProfileVisibility;
	availabilityVisibility: PrivacyVisibility;
	recruitingDiscoverability: boolean;
	publicHistoryVisibility: PrivacyVisibility;
};
export type DataExportStatus = {
	status: "available" | "pending" | "completed" | "failed";
	mode: "immediate_download" | "async_request";
	requestedAt: IsoDateString | null;
	completedAt: IsoDateString | null;
	downloadUrl: string | null;
};
export type AccountLifecycleState = {
	deletion: {
		status: "none" | "pending" | "cancelled" | "failed";
		isPending: boolean;
		scheduledAt: IsoDateString | null;
		cancelledAt: IsoDateString | null;
		failedAt: IsoDateString | null;
	};
	dataExport: DataExportStatus;
};
export type OnboardingProgressData = {
	battletag?: string;
	primaryRole?: OW2Role | null;
	secondaryRole?: OW2Role | null;
	rank?: string | null;
	rankDivision?: number | null;
	heroPool?: string[];
	participationIntent?: ParticipationIntent | null;
	availabilityIntent?: AvailabilityIntent | null;
};
export type OnboardingProgress = {
	currentStep: OnboardingStep;
	data: OnboardingProgressData;
	updatedAt: IsoDateString | null;
};
export type RosterStatus = "active" | "benched" | "trial" | "inactive";
export const TEAM_VIEWABLE_STATUSES = ["active", "benched", "trial"] as const;
export type TeamViewableStatus = (typeof TEAM_VIEWABLE_STATUSES)[number];
export type OrgPermissionRole = "owner" | "admin" | "member";
export type OrgRole = OrgPermissionRole;
export type TeamPermissionRole = "admin" | "member";
export type MemberType = "player" | "staff";
export type StaffRole = "coach" | "analyst" | "manager" | "staff";
export type InviteLifecycleStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";
export type OwnershipEntityType = "team" | "organization";
export type OwnershipWorkflowKind = "transfer" | "recovery";
export type OwnershipWorkflowStatus =
	| "pending"
	| "accepted"
	| "rejected"
	| "cancelled"
	| "expired"
	| "review_required"
	| "approved"
	| "blocked";
export type OwnershipVerificationState = "not_required" | "required" | "verified";
export type OwnershipReviewState = "not_required" | "required" | "approved" | "rejected";
export type OwnershipWorkflowResult =
	| "transferred"
	| "recovered"
	| "rejected"
	| "cancelled"
	| "expired"
	| "blocked";
export type LifecycleEntityType = "team" | "organization";
export type LifecycleStatus = "active" | "archived" | "deletion_pending" | "irreversible";
export type LifecycleActionKind =
	| "archive"
	| "restore"
	| "deletion_request"
	| "deletion_cancel"
	| "irreversible_settlement";
export type LifecycleVisibilityImpact =
	| "public_hidden"
	| "workspace_read_only"
	| "active_workflows_suspended"
	| "history_preserved";
export type LifecycleWorkflowSummary = {
	id: string;
	entityType: LifecycleEntityType;
	entityId: string;
	action: LifecycleActionKind;
	status: LifecycleStatus;
	actorUserId: string | null;
	reason: string | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	recoveryUntil: IsoDateString | null;
	settledAt: IsoDateString | null;
	result: string | null;
	visibilityImpact: LifecycleVisibilityImpact[];
};
export type RecruitmentListingCategory = "lft" | "lfp" | "lfr" | "lfs";
export type RecruitmentOwnerType = "player" | "team" | "organization";
export type RecruitmentListingStatus = "open" | "paused" | "closed" | "fulfilled" | "expired";
export type RecruitmentApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

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
	canViewWorkspace: boolean;
	canViewRoster: boolean;
	canViewSchedule: boolean;
	canViewScrims: boolean;
	canViewRecruiting: boolean;
	canViewChat: boolean;
	canViewUpdates: boolean;
	canManageAdmins: boolean;
	canManageMembers: boolean;
	canManageRoster: boolean;
	canManageInvites: boolean;
	canManageListings: boolean;
	canManageConversations: boolean;
	canManageSettings: boolean;
	canLeave: boolean;
};

export type TeamMemberSummary = {
	id: string;
	userId: string;
	username: string;
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
	bannerUrl: string | null;
	rating: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	isArchived: boolean;
	lifecycleStatus: LifecycleStatus;
	lifecycleWorkflow: LifecycleWorkflowSummary | null;
	isPublic: boolean;
	activeRosterCount: number;
	adminCount: number;
};

export type TeamAdminSummary = {
	id: string;
	userId: string;
	username: string;
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

export type TeamRatingHistoryEntry = {
	id: string;
	scrimId: string;
	opponentTeamId: string | null;
	opponentTeamName: string | null;
	opponentTeamTag: string | null;
	teamMapScore: number;
	opponentMapScore: number;
	result: "win" | "loss" | "draw";
	ratingBefore: number;
	ratingAfter: number;
	ratingDelta: number;
	ratingDeviationBefore: number | null;
	ratingDeviationAfter: number | null;
	scheduledAt: IsoDateString | null;
	createdAt: IsoDateString;
};

export type TeamWorkspaceConversation = RecruitmentConversationSummary;

export type OwnershipActorSummary = {
	userId: string | null;
	displayName: string | null;
};

export type OwnershipWorkflowSummary = {
	id: string;
	entityType: OwnershipEntityType;
	entityId: string;
	kind: OwnershipWorkflowKind;
	status: OwnershipWorkflowStatus;
	requester: OwnershipActorSummary;
	currentOwner: OwnershipActorSummary;
	recipient: OwnershipActorSummary | null;
	recoveryTarget: OwnershipActorSummary | null;
	verificationState: OwnershipVerificationState;
	reviewState: OwnershipReviewState;
	reason: string | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	expiresAt: IsoDateString | null;
	resolvedAt: IsoDateString | null;
	result: OwnershipWorkflowResult | null;
	visibility: "authorized" | "limited";
};

export type TeamWorkspaceDetail = TeamSummary & {
	currentUser: TeamPermissions;
	members: TeamMemberSummary[];
	players: TeamMemberSummary[];
	staff: TeamMemberSummary[];
	roster: TeamMemberSummary[];
	admins: TeamAdminSummary[];
	pendingInvites: TeamPendingInvite[];
	ownedListings: RecruitmentListingSummary[];
	conversations: TeamWorkspaceConversation[];
	applications: RecruitmentApplicationSummary[];
	ratingHistory: TeamRatingHistoryEntry[];
	ownershipWorkflow: OwnershipWorkflowSummary | null;
};

export type TeamWithRoster = TeamWorkspaceDetail;

export type PublicRosterMemberSummary = {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	memberType: MemberType;
	staffRole: StaffRole | null;
	roleInTeam: OW2Role | null;
	rank: string | null;
	status: RosterStatus;
};

export type TeamPublicPreview = {
	id: string;
	organizationId: string;
	organizationName: string;
	organizationSlug: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	rating: number;
	matchesPlayed: number;
	isRecruiting: boolean;
	isArchived: boolean;
	activeRosterCount: number;
	openListingCount: number;
	hasOpenListing: boolean;
	roster: PublicRosterMemberSummary[];
	listings: RecruitmentListingSummary[];
	wins: number;
	losses: number;
	draws: number;
	roleBreakdown: { tank: number; damage: number; support: number };
	recentScrims: {
		id: string;
		opponentName: string;
		opponentTag: string;
		result: "win" | "loss" | "draw";
		homeMapScore: number;
		awayMapScore: number;
		scheduledAt: IsoDateString | null;
	}[];
};

// ─── Organization types ────────────────────────────────────────────────────

export type OrgPermissions = {
	role: OrgPermissionRole | null;
	canManage: boolean;
	canManageBrand: boolean;
	canDelete: boolean;
	canTransferOwnership: boolean;
	canLeave: boolean;
	canManageMembers: boolean;
	canManageTeams: boolean;
	canManageInvites: boolean;
	canManageSettings: boolean;
};

export type OrgTeamRelationshipState = "active" | "archived";
export type OrgTeamVisibilityState = "public" | "private";
export type OrgTeamOversightSummaryState = "loaded" | "partial-failed" | "unavailable";
export type OrgTeamOversightSignalSeverity = "info" | "warning" | "critical";
export type OrgTeamOversightSignalCode =
	| "archived"
	| "private_team"
	| "no_active_roster"
	| "no_active_admin"
	| "pending_invites"
	| "recruiting"
	| "pending_applications"
	| "no_schedule"
	| "upcoming_scrim"
	| "recent_scrim"
	| "recent_update";

export type OrgTeamOversightSignal = {
	code: OrgTeamOversightSignalCode;
	label: string;
	severity: OrgTeamOversightSignalSeverity;
	count: number | null;
	at: IsoDateString | null;
};

export type OrgTeamOperationalHealth = {
	summaryState: OrgTeamOversightSummaryState;
	relationshipState: OrgTeamRelationshipState;
	visibility: OrgTeamVisibilityState;
	canOpenWorkspace: boolean;
	autonomyCopy: string;
	activeRosterCount: number;
	adminCount: number;
	pendingInviteCount: number;
	openListingCount: number;
	pendingApplicationCount: number;
	availabilityCount: number;
	upcomingScrimCount: number;
	recentScrimCount: number;
	latestUpdateAt: IsoDateString | null;
	latestScrimAt: IsoDateString | null;
	latestActivityAt: IsoDateString | null;
	signals: OrgTeamOversightSignal[];
};

export type UserOrgTeamSummary = {
	id: string;
	name: string;
	tag: string;
	canManage: boolean;
	canViewWorkspace: boolean;
	canViewRoster: boolean;
	canViewSchedule: boolean;
	canViewScrims: boolean;
	canViewRecruiting: boolean;
	canViewChat: boolean;
	canViewUpdates: boolean;
	canManageSettings: boolean;
	canLeave: boolean;
};

export type UserOrg = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	description: string | null;
	role: OrgPermissionRole;
	isPublic: boolean;
	teamCount: number;
	openListingCount: number;
	canManage: boolean;
	teams: UserOrgTeamSummary[];
};

export type OrgTeamSummary = TeamSummary & {
	oversight?: OrgTeamOperationalHealth;
};

export type OrgMemberSummary = {
	id: string;
	userId: string;
	username: string;
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

export type OrgWorkspaceDetail = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	description: string | null;
	website: string | null;
	discord: string | null;
	twitter: string | null;
	isPublic: boolean;
	lifecycleStatus: LifecycleStatus;
	lifecycleWorkflow: LifecycleWorkflowSummary | null;
	ownerId: string;
	currentUser: OrgPermissions;
	activeTeams: OrgTeamSummary[];
	archivedTeams: OrgTeamSummary[];
	members: OrgMemberSummary[];
	pendingInvites: OrgPendingInvite[];
	ownedListings: RecruitmentListingSummary[];
	conversations: RecruitmentConversationSummary[];
	ownershipWorkflow: OwnershipWorkflowSummary | null;
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
	openListingCount: number;
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
	openListings: RecruitmentListingSummary[];
	totalScrims: number;
	website: string | null;
	discord: string | null;
	twitter: string | null;
};

// ─── Discovery types ───────────────────────────────────────────────────────

export type DiscoveryTeam = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	rating: number;
	isRecruiting: boolean;
	activeRosterCount: number;
	openListingCount: number;
};

export type DiscoveryFilters = {
	recruiting?: boolean;
};

// ─── Recruitment types ─────────────────────────────────────────────────────

export type RecruitmentListingSummary = {
	id: string;
	category: RecruitmentListingCategory;
	type: RecruitmentListingCategory;
	status: RecruitmentListingStatus;
	ownerType: RecruitmentOwnerType;
	title: string;
	description: string | null;
	memberType: MemberType;
	staffRole: StaffRole | null;
	gameRoles: OW2Role[];
	rolesNeeded: OW2Role[];
	minRank: string | null;
	maxRank: string | null;
	minRating: number | null;
	maxRating: number | null;
	region: string | null;
	expiresAt: IsoDateString | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	ownerUserId: string;
	ownerUsername: string;
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
	rating: number | null;
	applicationCount: number;
	hasApplied: boolean;
	canManage: boolean;
	canApply: boolean;
};

export type RecruitmentApplicationSummary = {
	id: string;
	listingId: string;
	conversationId: string | null;
	status: RecruitmentApplicationStatus;
	message: string | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	senderType: RecruitmentOwnerType;
	senderUserId: string;
	senderUsername: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	senderOrganizationId: string | null;
	senderOrganizationName: string | null;
	senderOrganizationSlug: string | null;
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
	listingCategory: RecruitmentListingCategory;
	listingTitle: string;
};

export type RecruitmentApplicationReviewSummary = RecruitmentApplicationSummary & {
	reviewerNotes: string | null;
	isShortlisted: boolean;
};

export type RecruitmentConversationSummary = {
	conversationId: string;
	applicationId: string;
	listingId: string;
	listingCategory: RecruitmentListingCategory;
	listingTitle: string;
	listingStatus: RecruitmentListingStatus;
	applicationStatus: RecruitmentApplicationStatus;
	counterpartLabel: string;
	counterpartAvatarUrl: string | null;
	counterpartType: RecruitmentOwnerType;
	counterpartUsername: string | null;
	counterpartOrgSlug: string | null;
	organizationId: string | null;
	teamId: string | null;
	lastMessagePreview: string | null;
	lastMessageAt: IsoDateString | null;
	unreadCount: number;
	isArchived: boolean;
};

export type UpdatePostScopeType = "team" | "organization";
export type UpdatePostVisibility = "workspace" | "public";

export type UpdatePostSummary = {
	id: string;
	scopeType: UpdatePostScopeType;
	visibility: UpdatePostVisibility;
	title: string;
	body: string;
	authorUserId: string | null;
	authorDisplayName: string | null;
	teamId: string | null;
	teamName: string | null;
	teamTag: string | null;
	organizationId: string | null;
	organizationName: string | null;
	organizationSlug: string | null;
	canManage: boolean;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
};

export type RecruitmentMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	content: string;
	isSystemMessage: boolean;
	createdAt: IsoDateString;
};

export type ChatConversationType =
	| "scrim_lobby"
	| "scrim_negotiation"
	| "team"
	| "recruitment"
	| "direct";

export type ChatConversationSummary = {
	id: string;
	type: ChatConversationType;
	name: string;
	isArchived: boolean;
	scrimId: string | null;
	teamId: string | null;
	recruitmentApplicationId: string | null;
	lastMessagePreview: string | null;
	lastMessageAt: IsoDateString | null;
	unreadCount: number;
	participantCount: number;
};

export type ChatParticipantSummary = {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	role: string;
	joinedAt: IsoDateString;
	leftAt: IsoDateString | null;
};

export type ChatMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	content: string;
	replyToMessageId: string | null;
	isSystemMessage: boolean;
	editedAt: IsoDateString | null;
	deletedAt: IsoDateString | null;
	createdAt: IsoDateString;
};

export type ChatMessagePage = {
	items: ChatMessage[];
	nextCursor: IsoDateString | null;
};

export type ChatConversationDetail = ChatConversationSummary & {
	participants: ChatParticipantSummary[];
};

export type UserPresenceStatus = "online" | "away" | "offline";

export type UserPresence = {
	userId: string;
	status: UserPresenceStatus;
	lastSeenAt: IsoDateString | null;
};

export type CreateDirectConversationResult = {
	conversationId: string;
	isNew: boolean;
};

export type RealtimeErrorCode =
	| "access_denied"
	| "internal_error"
	| "invalid_payload"
	| "missing_field"
	| "session_invalid";

export type RealtimeSessionInvalidationReason =
	| "session_expired"
	| "session_revoked"
	| "unauthorized";

export type ChatClientCommand =
	| { type: "subscribe"; conversationId: string }
	| { type: "unsubscribe"; conversationId: string }
	| { type: "typing:start"; conversationId: string }
	| { type: "typing:stop"; conversationId: string }
	| { type: "presence:heartbeat" }
	| { type: "ping" };

export type ChatRealtimeEvent =
	| { type: "chat:connected"; userId: string }
	| { type: "chat:pong" }
	| {
			type: "chat:error";
			error: string;
			code: RealtimeErrorCode;
			retryable: boolean;
			conversationId?: string;
	  }
	| { type: "chat:session-invalidated"; reason: RealtimeSessionInvalidationReason }
	| { type: "conversation:subscribed"; conversationId: string }
	| { type: "conversation:unsubscribed"; conversationId: string }
	| { type: "message:new"; conversationId: string; message: ChatMessage }
	| { type: "message:updated"; conversationId: string; message: ChatMessage }
	| { type: "message:deleted"; conversationId: string; messageId: string; deletedAt: IsoDateString }
	| { type: "message:read"; conversationId: string; userId: string; lastReadMessageId: string }
	| { type: "typing:start"; conversationId: string; userId: string }
	| { type: "typing:stop"; conversationId: string; userId: string }
	| { type: "presence:update"; presence: UserPresence }
	| {
			type: "notification:new";
			notificationType: "new_message";
			conversationId: string;
			message: ChatMessage;
			senderId: string;
			conversation: ChatConversationSummary;
	  };

export type ScrimOcrJobRealtimePayload = {
	jobId: string;
	scrimId: string;
	status: OcrJobStatus;
	progressStage: OcrJobProgressStage;
	errorMessage: string | null;
	retryCount: number;
	processingTimeMs: number | null;
	updatedAt: IsoDateString;
};

export type AppRealtimeClientCommand =
	| { type: "subscribe:scrim"; scrimId: string }
	| { type: "unsubscribe:scrim"; scrimId: string }
	| { type: "subscribe:team"; teamId: string }
	| { type: "unsubscribe:team"; teamId: string }
	| { type: "ping" };

export type AppRealtimeEvent =
	| { type: "realtime:connected"; userId: string }
	| { type: "realtime:pong" }
	| {
			type: "realtime:error";
			error: string;
			code: RealtimeErrorCode;
			retryable: boolean;
			scrimId?: string;
			teamId?: string;
	  }
	| { type: "realtime:session-invalidated"; reason: RealtimeSessionInvalidationReason }
	| { type: "scrim:subscribed"; scrimId: string }
	| { type: "scrim:unsubscribed"; scrimId: string }
	| { type: "team:subscribed"; teamId: string }
	| { type: "team:unsubscribed"; teamId: string }
	| {
			type: "notification:created";
			notification: NotificationSummary;
			unreadCount: number;
	  }
	| {
			type: "notification:read";
			notificationId: string;
			unreadCount: number;
	  }
	| {
			type: "notification:read-all";
			unreadCount: number;
	  }
	| {
			type: "update:created";
			teamId: string;
			update: UpdatePostSummary;
	  }
	| {
			type: "update:updated";
			teamId: string;
			update: UpdatePostSummary;
	  }
	| {
			type: "update:deleted";
			teamId: string;
			updateId: string;
	  }
	| {
			type: "scrim:ocr-job-updated";
			scrimId: string;
			job: ScrimOcrJobRealtimePayload;
	  }
	| {
			type: "recruit:application-received";
			listingId: string;
			application: RecruitmentApplicationSummary;
	  }
	| {
			type: "recruit:managed-pending-count";
			pendingCount: number;
	  }
	| { type: "recruit:application-decided"; applicationId: string; status: "accepted" | "rejected" };

// ─── Scrim types ────────────────────────────────────────────────────────────

export type ScrimStatus =
	| "pending"
	| "accepted"
	| "scheduled"
	| "in_progress"
	| "awaiting_confirmation"
	| "completed"
	| "cancelled"
	| "disputed";

export type ScrimConfirmationStatus = "pending" | "confirmed" | "disputed";
export type ScrimDisputeResolution =
	| "pending"
	| "home_confirmed"
	| "away_confirmed"
	| "admin_resolved"
	| "voided";
export type OcrJobStatus = "queued" | "processing" | "completed" | "failed" | "requires_review";
export type OcrJobProgressStage =
	| "queued"
	| "claimed"
	| "preprocessing"
	| "provider_request"
	| "validating"
	| "requires_review"
	| "completed"
	| "failed";
export type OcrConfidenceFlag =
	| "incomplete_map_results"
	| "incomplete_player_stats"
	| "manual_review_required";

export type ScrimConfig = {
	mapPool?: string[];
	bestOf?: number;
	heroRestrictions?: string[];
	format?: string;
};

export type OcrGameHistoryMatch = {
	matchOrder: number;
	mapName: string;
	mapType:
		| "assault"
		| "clash"
		| "control"
		| "escort"
		| "flashpoint"
		| "hybrid"
		| "push"
		| "unknown"
		| null;
	gameMode:
		| "competitive_role_queue"
		| "competitive_open_queue"
		| "custom_game"
		| "conquest_meta_event"
		| "deathmatch"
		| "payload_race"
		| "stadium_competitive"
		| "unranked_role_queue"
		| "unranked_open_queue"
		| null;
	durationText: string | null;
	result: "victory" | "defeat" | "draw";
	allyScore: number;
	enemyScore: number;
};

export type OcrScoreboardPlayer = {
	playerName: string;
	hero: string | null;
	role: OW2Role | null;
	eliminations: number;
	assists: number;
	deaths: number;
	damage: number;
	healing: number;
	mitigation: number;
};

export type OcrGameHistoryExtractedResult = {
	screenshotType: "game_history";
	matches: OcrGameHistoryMatch[];
	warnings: string[];
};

export type OcrScoreboardExtractedResult = {
	screenshotType: "scoreboard";
	allyTeam: OcrScoreboardPlayer[];
	enemyTeam: OcrScoreboardPlayer[];
	warnings: string[];
};

export type OcrExtractedResult = OcrGameHistoryExtractedResult | OcrScoreboardExtractedResult;

export type ScrimTeamSummary = {
	id: string;
	name: string;
	tag: string;
	organizationId: string;
	organizationName: string | null;
	avatarUrl: string | null;
	rating: number;
};

export type ScrimConfirmationSummary = {
	id: string;
	teamId: string;
	teamName: string;
	teamTag: string;
	status: ScrimConfirmationStatus;
	disputeReason: string | null;
	confirmedByUserId: string | null;
	confirmedByDisplayName: string | null;
	confirmedAt: IsoDateString | null;
	updatedAt: IsoDateString;
};

export type ScrimRatingEventSummary = {
	id: string;
	teamId: string;
	teamName: string;
	teamTag: string;
	ratingBefore: number;
	ratingAfter: number;
	ratingDelta: number;
	ratingDeviationBefore: number | null;
	ratingDeviationAfter: number | null;
	createdAt: IsoDateString;
};

export type ScrimDisputeSummary = {
	resolution: ScrimDisputeResolution | null;
	resolvedByUserId: string | null;
	resolvedByDisplayName: string | null;
	resolvedAt: IsoDateString | null;
	notes: string | null;
};

export type ScrimPlayerStatSummary = {
	id: string;
	side: "home" | "away" | "unknown";
	userId: string | null;
	teamId: string | null;
	playerName: string;
	hero: string | null;
	role: OW2Role | null;
	eliminations: number | null;
	assists: number | null;
	deaths: number | null;
	damage: number | null;
	healing: number | null;
	mitigation: number | null;
};

export type ScrimMapSummary = {
	id: string;
	mapOrder: number;
	mapName: string;
	mapType:
		| "assault"
		| "clash"
		| "control"
		| "escort"
		| "flashpoint"
		| "hybrid"
		| "push"
		| "unknown";
	gameMode:
		| "competitive_role_queue"
		| "competitive_open_queue"
		| "custom_game"
		| "conquest_meta_event"
		| "deathmatch"
		| "payload_race"
		| "stadium_competitive"
		| "unranked_role_queue"
		| "unranked_open_queue";
	durationSeconds: number | null;
	result: "victory" | "defeat" | "draw";
	homeScore: number;
	awayScore: number;
	ocrJobId: string | null;
	players: ScrimPlayerStatSummary[];
};

export type ScrimResultDiffBasis =
	| "ocr_job"
	| "previous_revision"
	| "existing_result"
	| "manual_baseline";

export type ScrimResultFieldChange = {
	path: string;
	before: JsonValue;
	after: JsonValue;
};

export type ScrimResultChangeSummary = {
	basis: ScrimResultDiffBasis;
	changeCount: number;
	fieldChanges: ScrimResultFieldChange[];
};

export type ScrimResultRevisionPlayerSnapshot = {
	playerName: string;
	side: "home" | "away" | "unknown";
	hero: string | null;
	role: OW2Role | null;
	eliminations: number | null;
	assists: number | null;
	deaths: number | null;
	damage: number | null;
	healing: number | null;
	mitigation: number | null;
};

export type ScrimResultRevisionMapSnapshot = {
	mapOrder: number;
	mapName: string;
	mapType:
		| "assault"
		| "clash"
		| "control"
		| "escort"
		| "flashpoint"
		| "hybrid"
		| "push"
		| "unknown";
	scoreboardOcrJobId: string | null;
	homeScore: number;
	awayScore: number;
	durationSeconds: number | null;
	players: ScrimResultRevisionPlayerSnapshot[];
};

export type ScrimResultRevisionSnapshot = {
	homeMapScore: number;
	awayMapScore: number;
	startedAt: IsoDateString | null;
	endedAt: IsoDateString | null;
	maps: ScrimResultRevisionMapSnapshot[];
};

export type ScrimResultRevisionSummary = {
	id: string;
	revisionNumber: number;
	reportingTeamId: string | null;
	reportingTeamName: string | null;
	reportingTeamTag: string | null;
	submittedByUserId: string | null;
	submittedByDisplayName: string | null;
	sourceOcrJobId: string | null;
	homeMapScore: number;
	awayMapScore: number;
	startedAt: IsoDateString | null;
	endedAt: IsoDateString | null;
	snapshot: ScrimResultRevisionSnapshot;
	changeSummary: ScrimResultChangeSummary;
	createdAt: IsoDateString;
};

export type OcrJobSummary = {
	id: string;
	scrimId: string;
	screenshotType: string;
	imageUrl: string;
	status: OcrJobStatus;
	progressStage: OcrJobProgressStage;
	errorMessage: string | null;
	errorCode: string | null;
	retryCount: number;
	submittedByUserId: string | null;
	submittedByDisplayName: string | null;
	providerName: string | null;
	providerModel: string | null;
	promptVersion: string | null;
	runAfter: IsoDateString | null;
	processingTimeMs: number | null;
	confidenceFlags: OcrConfidenceFlag[];
	validatedOutput: OcrExtractedResult | null;
	startedAt: IsoDateString | null;
	completedAt: IsoDateString | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
};

export type ScrimSummary = {
	id: string;
	status: ScrimStatus;
	message: string | null;
	config: ScrimConfig;
	scheduledAt: IsoDateString | null;
	startedAt: IsoDateString | null;
	endedAt: IsoDateString | null;
	homeMapScore: number;
	awayMapScore: number;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	createdByUserId: string | null;
	createdByDisplayName: string | null;
	homeTeam: ScrimTeamSummary;
	awayTeam: ScrimTeamSummary | null;
	pendingConfirmationCount: number;
};

export type ScrimDetail = ScrimSummary & {
	confirmations: ScrimConfirmationSummary[];
	ocrJobs: OcrJobSummary[];
	ratingEvents: ScrimRatingEventSummary[];
	dispute: ScrimDisputeSummary;
	maps: ScrimMapSummary[];
	resultRevisions: ScrimResultRevisionSummary[];
};

// ─── Notification types ────────────────────────────────────────────────────

export type NotificationSummary = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	referenceType: string | null;
	referenceId: string | null;
	destinationHref: string | null;
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
	profileVisibility: ProfileVisibility;
	availabilityVisibility: PrivacyVisibility;
	recruitingDiscoverability: boolean;
	publicHistoryVisibility: PrivacyVisibility;
	participationIntent: ParticipationIntent;
	availabilityIntent: AvailabilityIntent;
	recruitingStatus: PlayerRecruitingStatus;
	heroes: {
		id: string;
		displayName: string;
		role: OW2Role;
		imageUrl: string | null;
	}[];
	teamHistory: PlayerTeamHistoryEntry[];
};

export type PlayerStats = {
	topTeamRating: number | null;
	scrimsPlayed: number;
	wins: number;
};

export type AvailabilityRow = {
	id: string;
	userId: string;
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

export type TeamScheduleMember = {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	memberType: MemberType;
	permissionRole: TeamPermissionRole;
	status: RosterStatus;
	gameRole: OW2Role | null;
	staffRole: StaffRole | null;
	availabilityHidden: boolean;
};

export type TeamSchedule = {
	teamId: string;
	teamName: string;
	teamTag: string;
	members: TeamScheduleMember[];
	availability: AvailabilityRow[];
};

// ─── Public player types ───────────────────────────────────────────────────

export type PublicHeroPoolEntry = {
	heroId: string;
	displayName: string;
	role: OW2Role;
	imageUrl: string | null;
};

export type PublicPlayerTeamMembership = {
	id: string;
	name: string;
	tag: string;
	organizationName: string;
	organizationSlug: string;
	status: TeamViewableStatus;
	joinedAt: IsoDateString;
	leftAt: IsoDateString | null;
};

export type PlayerTeamHistoryEntry = PublicPlayerTeamMembership;

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
	profileVisibility: "public";
	availabilityIntent: AvailabilityIntent | null;
	recruitingStatus: PlayerRecruitingStatus;
	openListings: RecruitmentListingSummary[];
};

export type PublicPlayerDetail = PublicPlayerSummary & {
	bannerUrl: string | null;
	battletag: string | null;
	heroPool: PublicHeroPoolEntry[];
	teams: PublicPlayerTeamMembership[];
	scrimStats: { scrimsPlayed: number; wins: number; losses: number; draws: number } | null;
};

// ─── Hero types ────────────────────────────────────────────────────────────

export type HeroRow = {
	id: string;
	displayName: string;
	role: OW2Role;
	imageUrl: string | null;
	description: string | null;
};
