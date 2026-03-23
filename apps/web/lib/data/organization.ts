import type {
	OrgInviteSummary,
	OrgMemberSummary,
	OrgPendingInvite,
	OrgRole,
	OrgTeamSummary,
	OrgWithTeams,
	UserOrg,
} from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type {
	OrgInviteSummary,
	OrgMemberSummary,
	OrgPendingInvite,
	OrgRole,
	OrgTeamSummary,
	OrgWithTeams,
	UserOrg,
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
	throw new Error(res.error);
});

export const getOrgWithTeams = cache(
	async (orgId: string, _userId: string): Promise<OrgWithTeams | null> => {
		const res = await apiGet<OrgWithTeams>(`/api/orgs/${orgId}`);
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export async function getPendingOrgInvitesForUser(_userId: string): Promise<OrgInviteSummary[]> {
	const res = await apiGet<OrgInviteSummary[]>("/api/orgs/invites/received");
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export async function getOrgPendingInvites(
	orgId: string,
	_userId: string
): Promise<OrgPendingInvite[]> {
	const res = await apiGet<OrgPendingInvite[]>(`/api/orgs/${orgId}/invites`);
	if ("data" in res) return res.data;
	throw new Error(res.error);
}
