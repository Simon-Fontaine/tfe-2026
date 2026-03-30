export const apiRoutes = {
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
		requests: {
			root: (orgId: string) => `/api/orgs/${orgId}/requests`,
			respond: (orgId: string, requestId: string) =>
				`/api/orgs/${orgId}/requests/${requestId}/respond`,
		},
	},
	teams: {
		root: "/api/teams",
		byId: (teamId: string) => `/api/teams/${teamId}`,
		admins: (teamId: string) => `/api/teams/${teamId}/admins`,
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
		requests: {
			root: (teamId: string) => `/api/teams/${teamId}/requests`,
			respond: (teamId: string, requestId: string) =>
				`/api/teams/${teamId}/requests/${requestId}/respond`,
		},
		applications: (teamId: string) => `/api/teams/${teamId}/applications`,
		lfg: (teamId: string) => `/api/teams/${teamId}/posts`,
		posts: (teamId: string) => `/api/teams/${teamId}/posts`,
		conversations: (teamId: string) => `/api/teams/${teamId}/conversations`,
	},
	posts: {
		root: "/api/posts",
		mine: "/api/posts/mine",
		byId: (postId: string) => `/api/posts/${postId}`,
		responses: (postId: string) => `/api/posts/${postId}/responses`,
		publicRoot: "/api/public/posts",
	},
	responses: {
		root: "/api/responses",
		mine: "/api/responses/mine",
		byId: (responseId: string) => `/api/responses/${responseId}`,
		decision: (responseId: string) => `/api/responses/${responseId}/decision`,
	},
	chat: {
		conversations: "/api/chat/conversations",
		createDirect: "/api/chat/conversations/direct",
		ws: "/api/chat/ws",
		byId: (conversationId: string) => `/api/chat/conversations/${conversationId}`,
		messages: (conversationId: string) => `/api/chat/conversations/${conversationId}/messages`,
		message: (conversationId: string, messageId: string) =>
			`/api/chat/conversations/${conversationId}/messages/${messageId}`,
		read: (conversationId: string) => `/api/chat/conversations/${conversationId}/read`,
		presence: (userId: string) => `/api/chat/presence/${userId}`,
	},
	recruit: {
		posts: {
			root: "/api/posts",
			mine: "/api/posts/mine",
			byId: (postId: string) => `/api/posts/${postId}`,
			responses: (postId: string) => `/api/posts/${postId}/responses`,
			publicRoot: "/api/public/posts",
		},
		responses: {
			root: "/api/responses",
			mine: "/api/responses/mine",
			byId: (responseId: string) => `/api/responses/${responseId}`,
			decision: (responseId: string) => `/api/responses/${responseId}/decision`,
		},
	},
	lfg: {
		root: "/api/posts",
		byId: (postId: string) => `/api/posts/${postId}`,
		applications: "/api/responses/mine",
		close: (postId: string) => `/api/posts/${postId}`,
		apply: (postId: string) => `/api/posts/${postId}/responses`,
		applicationById: (_postId: string, applicationId: string) => `/api/responses/${applicationId}`,
		respondToApplication: (_postId: string, applicationId: string) =>
			`/api/responses/${applicationId}/decision`,
	},
} as const;

export const dashboardRoutes = {
	home: "/dashboard",
	organizations: "/dashboard/orgs",
	personal: {
		root: "/dashboard",
		profile: "/dashboard/profile",
		notifications: "/dashboard/notifications",
		invitations: "/dashboard/invitations",
		recruitingActivity: "/dashboard/recruiting/activity",
		settings: {
			root: "/dashboard/settings",
			account: "/dashboard/settings/account",
			security: "/dashboard/settings/security",
		},
	},
	discover: {
		root: "/dashboard/recruiting",
		posts: "/dashboard/recruiting/posts",
		conversations: "/dashboard/recruiting/conversations",
		invitations: "/dashboard/invitations",
	},
	orgs: {
		byId: (orgId: string) => `/dashboard/orgs/${orgId}`,
		teams: (orgId: string) => `/dashboard/orgs/${orgId}/teams`,
		members: (orgId: string) => `/dashboard/orgs/${orgId}/members`,
		recruitingPosts: (orgId: string) => `/dashboard/orgs/${orgId}/recruiting/posts`,
		recruitingConversations: (orgId: string) => `/dashboard/orgs/${orgId}/recruiting/conversations`,
		invites: (orgId: string) => `/dashboard/orgs/${orgId}/invites`,
		settings: (orgId: string) => `/dashboard/orgs/${orgId}/settings`,
	},
	teams: {
		byId: (teamId: string) => `/dashboard/teams/${teamId}`,
		roster: (teamId: string) => `/dashboard/teams/${teamId}/roster`,
		schedule: (teamId: string) => `/dashboard/teams/${teamId}/schedule`,
		recruitingPosts: (teamId: string) => `/dashboard/teams/${teamId}/recruiting/posts`,
		recruitingConversations: (teamId: string) =>
			`/dashboard/teams/${teamId}/recruiting/conversations`,
		invites: (teamId: string) => `/dashboard/teams/${teamId}/invites`,
		settings: (teamId: string) => `/dashboard/teams/${teamId}/settings`,
	},
	context: {
		orgById: (orgId: string) => `/dashboard/orgs/${orgId}`,
		orgTeams: (orgId: string) => `/dashboard/orgs/${orgId}/teams`,
		orgMembers: (orgId: string) => `/dashboard/orgs/${orgId}/members`,
		orgPosts: (orgId: string) => `/dashboard/orgs/${orgId}/recruiting/posts`,
		orgConversations: (orgId: string) => `/dashboard/orgs/${orgId}/recruiting/conversations`,
		orgInvites: (orgId: string) => `/dashboard/orgs/${orgId}/invites`,
		orgSettings: (orgId: string) => `/dashboard/orgs/${orgId}/settings`,
		teamById: (_orgId: string, teamId: string) => `/dashboard/teams/${teamId}`,
		teamPlayers: (_orgId: string, teamId: string) =>
			`/dashboard/teams/${teamId}/roster?type=players`,
		teamStaff: (_orgId: string, teamId: string) => `/dashboard/teams/${teamId}/roster?type=staff`,
		teamPosts: (_orgId: string, teamId: string) => `/dashboard/teams/${teamId}/recruiting/posts`,
		teamConversations: (_orgId: string, teamId: string) =>
			`/dashboard/teams/${teamId}/recruiting/conversations`,
		teamInvites: (_orgId: string, teamId: string) => `/dashboard/teams/${teamId}/invites`,
		teamSettings: (_orgId: string, teamId: string) => `/dashboard/teams/${teamId}/settings`,
	},
} as const;

export const publicRoutes = {
	orgs: {
		root: "/orgs",
		bySlug: (slug: string) => `/orgs/${slug}`,
	},
	teams: {
		root: "/teams",
		byId: (teamId: string) => `/teams/${teamId}`,
	},
	players: {
		root: "/players",
		byUsername: (username: string) => `/players/${username}`,
	},
} as const;
