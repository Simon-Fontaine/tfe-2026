import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMemberTable, organizationTable } from "@/db/schema";

export type OrgRole = "owner" | "manager" | "coach" | "analyst" | "player";

/**
 * Returns the user's role in the given org, or null if not a member.
 */
export async function getUserOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
	const row = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: { role: true },
	});
	return row ? (row.role as OrgRole) : null;
}

/**
 * Checks whether a user has management-level access to an org (owner or manager).
 */
export async function verifyOrgManager(orgId: string, userId: string): Promise<boolean> {
	const role = await getUserOrgRole(orgId, userId);
	return role === "owner" || role === "manager";
}

/**
 * Converts an org name into a URL-safe slug.
 */
export function nameToSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "org"
	);
}

/**
 * Ensures a slug is unique by appending a random suffix if needed.
 */
export async function ensureUniqueSlug(base: string): Promise<string> {
	const existing = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.slug, base),
		columns: { id: true },
	});
	if (!existing) return base;

	const suffix = Math.random().toString(36).substring(2, 6);
	const candidate = `${base}-${suffix}`;
	const conflict = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.slug, candidate),
		columns: { id: true },
	});
	return conflict ? `${candidate}-${Math.random().toString(36).substring(2, 6)}` : candidate;
}
