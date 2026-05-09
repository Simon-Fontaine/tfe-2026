import type { AuthStep } from "./types";

type AuthStepUrlOptions = {
	next?: string | null;
};

const withQuery = (pathname: string, values: Record<string, string | null | undefined>) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(values)) {
		if (value) params.set(key, value);
	}
	const query = params.toString();
	return query ? `${pathname}?${query}` : pathname;
};

export const apiRoutes = {
	auth: {
		session: "/api/auth/session",
		login: "/api/auth/login",
		logout: "/api/auth/logout",
		credentials: {
			challenge: "/api/auth/credentials/challenge",
			passkeys: "/api/auth/credentials/passkeys",
			securityKeys: "/api/auth/credentials/security-keys",
			passkey: {
				register: "/api/auth/credentials/passkey/register",
			},
			securityKey: {
				register: "/api/auth/credentials/security-key/register",
			},
		},
		register: {
			root: "/api/auth/register",
			checkUsername: (username: string) =>
				`/api/auth/register/check-username?username=${encodeURIComponent(username.trim())}`,
		},
		twoFactor: {
			totp: "/api/auth/2fa/totp",
			recovery: "/api/auth/2fa/recovery",
		},
		totp: {
			root: "/api/auth/totp",
			generate: "/api/auth/totp/generate",
			enable: "/api/auth/totp/enable",
			status: "/api/auth/totp/status",
		},
		verify: {
			email: "/api/auth/verify/email",
			device: "/api/auth/verify/device",
			resend: "/api/auth/verify/resend",
		},
		webauthn: {
			challenge: "/api/auth/webauthn/challenge",
			passkey: {
				verify: "/api/auth/webauthn/passkey/verify",
				login: "/api/auth/webauthn/passkey/login",
			},
			securityKey: {
				verify: "/api/auth/webauthn/security-key/verify",
			},
		},
		forgotPassword: "/api/auth/forgot-password",
		resetPassword: "/api/auth/reset-password",
	},
	onboarding: {
		profile: "/api/onboarding/profile",
	},
	profile: {
		root: "/api/profile",
		exists: "/api/profile/exists",
		userInfo: "/api/profile/user-info",
		stats: "/api/profile/stats",
		basic: "/api/profile/basic",
		game: "/api/profile/game",
	},
	settings: {
		root: "/api/settings",
		account: {
			deletion: {
				root: "/api/settings/account/deletion",
				request: "/api/settings/account/deletion/request",
				confirm: "/api/settings/account/deletion/confirm",
			},
		},
		credentials: {
			passkey: {
				disable: {
					request: "/api/settings/credentials/passkey/disable/request",
					confirm: "/api/settings/credentials/passkey/disable/confirm",
				},
			},
			securityKey: {
				disable: {
					request: "/api/settings/credentials/security-key/disable/request",
					confirm: "/api/settings/credentials/security-key/disable/confirm",
				},
			},
		},
		email: {
			request: "/api/settings/email/request",
			verify: "/api/settings/email/verify",
		},
		password: {
			request: "/api/settings/password/request",
			confirm: "/api/settings/password/confirm",
		},
		security: {
			summary: "/api/settings/security/summary",
			recoveryCodeRegenerate: "/api/settings/security/recovery-code/regenerate",
		},
		sessions: {
			root: "/api/settings/sessions",
			byId: (sessionId: string) => `/api/settings/sessions/${sessionId}`,
			logout: "/api/settings/sessions/logout",
		},
		twoFactorDisable: {
			request: "/api/settings/2fa/request",
			confirm: "/api/settings/2fa/confirm",
		},
		username: "/api/settings/username",
		verifications: {
			pending: "/api/settings/verifications/pending",
		},
		notificationPreferences: "/api/settings/notifications",
		privacy: "/api/settings/privacy",
		dataExport: "/api/settings/data-export",
	},
	schedule: {
		availability: {
			root: "/api/schedule/availability",
			byId: (availabilityId: string) => `/api/schedule/availability/${availabilityId}`,
		},
		teams: "/api/schedule/teams",
		teamById: (teamId: string) => `/api/schedule/team/${teamId}`,
	},
	orgs: {
		root: "/api/orgs",
		byId: (orgId: string) => `/api/orgs/${orgId}`,
		leave: (orgId: string) => `/api/orgs/${orgId}/leave`,
		transferOwnership: (orgId: string) => `/api/orgs/${orgId}/ownership`,
		publicRoot: "/api/public/orgs",
		publicById: (orgIdOrSlug: string) => `/api/public/orgs/${orgIdOrSlug}`,
		members: {
			byId: (orgId: string, memberId: string) => `/api/orgs/${orgId}/members/${memberId}`,
			role: (orgId: string, memberId: string) => `/api/orgs/${orgId}/members/${memberId}/role`,
		},
		invites: {
			received: "/api/orgs/invites/received",
			pending: (orgId: string) => `/api/orgs/${orgId}/invites`,
			cancel: (orgId: string, inviteId: string) => `/api/orgs/${orgId}/invites/${inviteId}`,
			resend: (orgId: string, inviteId: string) => `/api/orgs/${orgId}/invites/${inviteId}/resend`,
			respond: (inviteId: string) => `/api/orgs/invites/${inviteId}/respond`,
		},
	},
	teams: {
		root: "/api/teams",
		byId: (teamId: string) => `/api/teams/${teamId}`,
		recruiting: (teamId: string) => `/api/teams/${teamId}/recruiting`,
		archive: (teamId: string) => `/api/teams/${teamId}/archive`,
		publicRoot: "/api/public/teams",
		memberRole: (teamId: string, memberId: string) =>
			`/api/teams/${teamId}/members/${memberId}/role`,
		unarchive: (teamId: string) => `/api/teams/${teamId}/unarchive`,
		leave: (teamId: string) => `/api/teams/${teamId}/leave`,
		publicById: (teamId: string) => `/api/public/teams/${teamId}`,
		invites: {
			received: "/api/teams/invites/received",
			pending: (teamId: string) => `/api/teams/${teamId}/invites`,
			respond: (inviteId: string) => `/api/teams/invites/${inviteId}/respond`,
			cancel: (teamId: string, inviteId: string) => `/api/teams/${teamId}/invites/${inviteId}`,
			resend: (teamId: string, inviteId: string) =>
				`/api/teams/${teamId}/invites/${inviteId}/resend`,
		},
		roster: {
			root: (teamId: string) => `/api/teams/${teamId}/roster`,
			byId: (teamId: string, rosterId: string) => `/api/teams/${teamId}/roster/${rosterId}`,
		},
		recruitment: {
			listings: (teamId: string) => `/api/teams/${teamId}/recruitment/listings`,
			applications: (teamId: string) => `/api/teams/${teamId}/recruitment/applications`,
			conversations: (teamId: string) => `/api/teams/${teamId}/recruitment/conversations`,
		},
	},
	recruitment: {
		listings: {
			root: "/api/recruitment/listings",
			mine: "/api/recruitment/listings/mine",
			byId: (listingId: string) => `/api/recruitment/listings/${listingId}`,
			applications: (listingId: string) => `/api/recruitment/listings/${listingId}/applications`,
			publicRoot: "/api/public/recruitment/listings",
			publicById: (listingId: string) => `/api/public/recruitment/listings/${listingId}`,
		},
		applications: {
			root: "/api/recruitment/applications",
			mine: "/api/recruitment/applications/mine",
			byId: (applicationId: string) => `/api/recruitment/applications/${applicationId}`,
			decision: (applicationId: string) =>
				`/api/recruitment/applications/${applicationId}/decision`,
			pendingCount: "/api/recruitment/applications/pending-count",
		},
	},
	scrims: {
		root: "/api/scrims",
		byId: (scrimId: string) => `/api/scrims/${scrimId}`,
		respond: (scrimId: string) => `/api/scrims/${scrimId}/respond`,
		result: (scrimId: string) => `/api/scrims/${scrimId}/result`,
		confirm: (scrimId: string) => `/api/scrims/${scrimId}/confirm`,
		resolveDispute: (scrimId: string) => `/api/scrims/${scrimId}/resolve-dispute`,
		ocrJobs: (scrimId: string) => `/api/scrims/${scrimId}/ocr-jobs`,
		retryOcrJob: (scrimId: string, jobId: string) =>
			`/api/scrims/${scrimId}/ocr-jobs/${jobId}/retry`,
		publicRoot: "/api/public/scrims",
	},
	uploads: {
		root: "/api/uploads",
		assets: "/api/uploads/assets",
		scrimEvidenceIntents: "/api/uploads/scrim-evidence/intents",
		scrimEvidenceFinalize: "/api/uploads/scrim-evidence/finalize",
	},
	realtime: {
		ws: "/api/realtime/ws",
	},
	notifications: {
		root: "/api/notifications",
		unreadCount: "/api/notifications/unread-count",
		read: (notificationId: string) => `/api/notifications/${notificationId}/read`,
		readAll: "/api/notifications/read-all",
	},
	updates: {
		root: "/api/updates",
		byId: (updateId: string) => `/api/updates/${updateId}`,
		publicRoot: "/api/public/updates",
	},
	heroes: {
		root: "/api/heroes",
	},
	players: {
		publicRoot: "/api/public/players",
		publicByUsername: (username: string) => `/api/public/players/${username}`,
	},
	publicStats: "/api/public/stats",
	chat: {
		conversations: "/api/chat/conversations",
		createDirect: "/api/chat/conversations/direct",
		teamConversations: (teamId: string) => `/api/chat/teams/${teamId}/conversations`,
		scrimConversations: (scrimId: string) => `/api/chat/scrims/${scrimId}/conversations`,
		ws: "/api/chat/ws",
		byId: (conversationId: string) => `/api/chat/conversations/${conversationId}`,
		messages: (conversationId: string) => `/api/chat/conversations/${conversationId}/messages`,
		message: (conversationId: string, messageId: string) =>
			`/api/chat/conversations/${conversationId}/messages/${messageId}`,
		read: (conversationId: string) => `/api/chat/conversations/${conversationId}/read`,
		presence: (userId: string) => `/api/chat/presence/${userId}`,
	},
} as const;

export const appRoutes = {
	root: "/app",
	me: "/app/me",
	inbox: "/app/inbox",
	calendar: "/app/calendar",
	profile: "/app/profile",
	deletionPending: "/deletion-pending",
	settings: {
		root: "/app/settings",
		account: "/app/settings/account",
		security: "/app/settings/security",
		notifications: "/app/settings/notifications",
		privacy: "/app/settings/privacy",
	},
	recruiting: {
		root: "/app/recruiting",
		conversations: "/app/recruiting/conversations",
		byId: (listingId: string) => `/app/recruiting/${listingId}`,
	},
	teams: {
		byId: (teamId: string) => `/app/teams/${teamId}`,
		scrimById: (teamId: string, scrimId: string) => `/app/teams/${teamId}/scrims/${scrimId}`,
		roster: (teamId: string) => `/app/teams/${teamId}/roster`,
		calendar: (teamId: string) => `/app/teams/${teamId}/calendar`,
		scrims: (teamId: string) => `/app/teams/${teamId}/scrims`,
		recruiting: (teamId: string) => `/app/teams/${teamId}/recruiting`,
		chat: (teamId: string) => `/app/teams/${teamId}/chat`,
		updates: (teamId: string) => `/app/teams/${teamId}/updates`,
		settings: (teamId: string) => `/app/teams/${teamId}/settings`,
	},
	orgs: {
		root: "/app/orgs",
		byId: (orgId: string) => `/app/orgs/${orgId}`,
		teams: (orgId: string) => `/app/orgs/${orgId}/teams`,
		staff: (orgId: string) => `/app/orgs/${orgId}/staff`,
		invites: (orgId: string) => `/app/orgs/${orgId}/invites`,
		brand: (orgId: string) => `/app/orgs/${orgId}/brand`,
		recruiting: (orgId: string) => `/app/orgs/${orgId}/recruiting`,
		settings: (orgId: string) => `/app/orgs/${orgId}/settings`,
	},
} as const;

export const publicRoutes = {
	home: "/",
	about: "/about",
	contact: "/contact",
	privacy: "/privacy",
	terms: "/terms",
	auth: {
		root: "/auth",
		step: (step: AuthStep, options: AuthStepUrlOptions = {}) =>
			withQuery("/auth", { step, next: options.next }),
	},
	orgs: {
		root: "/orgs",
		bySlug: (slug: string) => `/orgs/${slug}`,
		withSort: (sort: "teams" | "roster" | "name") =>
			sort === "teams" ? "/orgs" : withQuery("/orgs", { sort }),
	},
	teams: {
		root: "/teams",
		byId: (teamId: string) => `/teams/${teamId}`,
	},
	players: {
		root: "/players",
		byUsername: (username: string) => `/players/${username}`,
	},
	recruiting: {
		root: "/recruiting",
		byId: (listingId: string) => `/recruiting/${listingId}`,
	},
	scrims: {
		root: "/scrims",
		withStatus: (status: "all" | "scheduled" | "completed" | "disputed") =>
			status === "all" ? "/scrims" : withQuery("/scrims", { status }),
	},
	updates: {
		root: "/updates",
		withScope: (scope: "all" | "team" | "organization") =>
			scope === "all" ? "/updates" : withQuery("/updates", { scope }),
	},
} as const;
