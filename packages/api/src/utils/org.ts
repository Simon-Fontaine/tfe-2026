import {
	canDeleteOrg,
	canManageOrg,
	canTransferOrgOwnership,
	type OrgRole,
} from "@scrimflow/shared";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { organizationMemberTable, organizationTable } from "@/db/schema";

export type OrgMembership = {
	id: string;
	userId: string;
	organizationId: string;
	role: OrgRole;
};

export async function getOrgMembership(
	orgId: string,
	userId: string
): Promise<OrgMembership | null> {
	const row = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: {
			id: true,
			userId: true,
			organizationId: true,
			role: true,
		},
	});

	return row
		? {
				id: row.id,
				userId: row.userId,
				organizationId: row.organizationId,
				role: row.role as OrgRole,
			}
		: null;
}

export async function getUserOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
	const membership = await getOrgMembership(orgId, userId);
	return membership?.role ?? null;
}

export async function verifyOrgManager(orgId: string, userId: string): Promise<boolean> {
	const role = await getUserOrgRole(orgId, userId);
	return canManageOrg(role);
}

export async function getOrgPermissions(orgId: string, userId: string) {
	const membership = await getOrgMembership(orgId, userId);
	const role = membership?.role ?? null;

	return {
		membership,
		role,
		canManage: canManageOrg(role),
		canDelete: canDeleteOrg(role),
		canTransferOwnership: canTransferOrgOwnership(role),
		canLeave: role !== "owner" && role !== null,
		canReviewRequests: canManageOrg(role),
		canManageMembers: canManageOrg(role),
		canManageTeams: canManageOrg(role),
	};
}

export function nameToSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "org"
	);
}

export async function ensureUniqueSlug(base: string, ignoreOrgId?: string): Promise<string> {
	const existing = await db.query.organizationTable.findFirst({
		where: ignoreOrgId
			? and(eq(organizationTable.slug, base), ne(organizationTable.id, ignoreOrgId))
			: eq(organizationTable.slug, base),
		columns: { id: true },
	});
	if (!existing) return base;

	const suffix = Math.random().toString(36).substring(2, 6);
	const candidate = `${base}-${suffix}`;
	const conflict = await db.query.organizationTable.findFirst({
		where: ignoreOrgId
			? and(eq(organizationTable.slug, candidate), ne(organizationTable.id, ignoreOrgId))
			: eq(organizationTable.slug, candidate),
		columns: { id: true },
	});
	return conflict ? `${candidate}-${Math.random().toString(36).substring(2, 6)}` : candidate;
}
