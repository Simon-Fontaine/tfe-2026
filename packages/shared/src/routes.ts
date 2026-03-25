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
		requests: {
			root: (teamId: string) => `/api/teams/${teamId}/requests`,
			respond: (teamId: string, requestId: string) =>
				`/api/teams/${teamId}/requests/${requestId}/respond`,
		},
		roster: {
			root: (teamId: string) => `/api/teams/${teamId}/roster`,
			byId: (teamId: string, rosterId: string) => `/api/teams/${teamId}/roster/${rosterId}`,
		},
		applications: (teamId: string) => `/api/teams/${teamId}/applications`,
		lfg: (teamId: string) => `/api/teams/${teamId}/lfg`,
	},
	lfg: {
		root: "/api/lfg",
		byId: (postId: string) => `/api/lfg/${postId}`,
		applications: "/api/lfg/applications",
		close: (postId: string) => `/api/lfg/${postId}/close`,
		apply: (postId: string) => `/api/lfg/${postId}/apply`,
		applicationById: (postId: string, applicationId: string) =>
			`/api/lfg/${postId}/applications/${applicationId}`,
		respondToApplication: (postId: string, applicationId: string) =>
			`/api/lfg/${postId}/applications/${applicationId}/respond`,
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
		lfg: "/dashboard/recruit/lfg",
		invitations: "/dashboard/recruit/invitations",
		applications: "/dashboard/recruit/applications",
	},
	me: {
		schedule: "/dashboard/me/schedule",
	},
} as const;
