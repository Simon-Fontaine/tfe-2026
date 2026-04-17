import type {
	OrgInviteSummary,
	OrgMemberSummary,
	OrgPendingInvite,
	OrgRole,
	OrgTeamSummary,
	OrgWithTeams,
	PublicOrgDetail,
	PublicOrgSummary,
	UserOrg,
} from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type {
	OrgInviteSummary,
	OrgMemberSummary,
	OrgPendingInvite,
	OrgRole,
	OrgTeamSummary,
	PublicOrgDetail,
	PublicOrgSummary,
	OrgWithTeams,
	UserOrg,
};

// ─── Derived helpers ────────────────────────────────────────────────────────────

export async function getUserOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
	const org = await getOrgWithTeams(orgId, userId);
	return org?.currentUser.role ?? null;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getOrgsForUser = cache(async (_userId: string): Promise<UserOrg[]> => {
	const res = await apiGet<UserOrg[]>(apiRoutes.orgs.root);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getOrgWithTeams = cache(
	async (orgId: string, _userId: string): Promise<OrgWithTeams | null> => {
		const res = await apiGet<OrgWithTeams>(apiRoutes.orgs.byId(orgId));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export async function getPendingOrgInvitesForUser(_userId: string): Promise<OrgInviteSummary[]> {
	const res = await apiGet<OrgInviteSummary[]>(apiRoutes.orgs.invites.received);
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export async function getOrgPendingInvites(
	orgId: string,
	_userId: string
): Promise<OrgPendingInvite[]> {
	const res = await apiGet<OrgPendingInvite[]>(apiRoutes.orgs.invites.pending(orgId));
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export const getPublicOrgs = cache(async (): Promise<PublicOrgSummary[]> => {
	const res = await apiGet<PublicOrgSummary[]>(apiRoutes.orgs.publicRoot);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getPublicOrgByIdOrSlug = cache(
	async (orgIdOrSlug: string): Promise<PublicOrgDetail | null> => {
		const res = await apiGet<PublicOrgDetail>(apiRoutes.orgs.publicById(orgIdOrSlug));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);
