import { cache } from "react";

import { apiGet } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrgRole = "owner" | "manager" | "coach" | "analyst" | "player";

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
	expiresAt: Date;
	createdAt: Date;
};

export type OrgPendingInvite = {
	id: string;
	inviteeUserId: string;
	inviteeDisplayName: string;
	inviteeAvatarUrl: string | null;
	role: OrgRole;
	expiresAt: Date;
	createdAt: Date;
};

// ─── Derived helpers ────────────────────────────────────────────────────────────

export async function getUserOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
	const org = await getOrgWithTeams(orgId, userId);
	if (!org) return null;
	const member = org.members.find((m) => m.userId === userId);
	return member?.role ?? null;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getOrgsForUser = cache(async (_userId: string): Promise<UserOrg[]> => {
	const res = await apiGet<UserOrg[]>("/api/orgs");
	if ("data" in res) return res.data;
	return [];
});

export const getOrgWithTeams = cache(
	async (orgId: string, _userId: string): Promise<OrgWithTeams | null> => {
		const res = await apiGet<OrgWithTeams>(`/api/orgs/${orgId}`);
		if ("data" in res) return res.data;
		return null;
	}
);

export async function getPendingOrgInvitesForUser(_userId: string): Promise<OrgInviteSummary[]> {
	const res = await apiGet<OrgInviteSummary[]>("/api/orgs/invites/received");
	if ("data" in res) return res.data;
	return [];
}

export async function getOrgPendingInvites(
	orgId: string,
	_userId: string
): Promise<OrgPendingInvite[]> {
	const res = await apiGet<OrgPendingInvite[]>(`/api/orgs/${orgId}/invites`);
	if ("data" in res) return res.data;
	return [];
}
