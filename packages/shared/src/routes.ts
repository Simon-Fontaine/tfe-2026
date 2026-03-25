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
	threads: {
		root: "/api/threads",
		byId: (threadId: string) => `/api/threads/${threadId}`,
		messages: (threadId: string) => `/api/threads/${threadId}/messages`,
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
		threads: {
			root: "/api/threads",
			byId: (threadId: string) => `/api/threads/${threadId}`,
			messages: (threadId: string) => `/api/threads/${threadId}/messages`,
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
	workspace: {
		orgs: "/dashboard/workspace/orgs",
		orgById: (orgId: string) => `/dashboard/workspace/orgs/${orgId}`,
		teamById: (orgId: string, teamId: string) =>
			`/dashboard/workspace/orgs/${orgId}/teams/${teamId}`,
	},
	recruit: {
		posts: "/dashboard/recruit/posts",
		conversations: "/dashboard/recruit/conversations",
		invitations: "/dashboard/recruit/invitations",
		lfg: "/dashboard/recruit/posts",
		applications: "/dashboard/recruit/conversations",
	},
	me: {
		schedule: "/dashboard/me/schedule",
	},
} as const;
