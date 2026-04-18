import type { UpdatePostSummary } from "@scrimflow/shared";

export function mapUpdatePost(
	row: {
		id: string;
		scopeType: "team" | "organization";
		visibility: "workspace" | "public";
		title: string;
		body: string;
		authorUserId: string | null;
		createdAt: Date;
		updatedAt: Date;
		author?: { id: string; displayName: string | null } | null;
		team?: { id: string; name: string; tag: string; organizationId: string } | null;
		organization?: { id: string; name: string; slug: string } | null;
	},
	params?: {
		canManage?: boolean;
	}
): UpdatePostSummary {
	return {
		id: row.id,
		scopeType: row.scopeType,
		visibility: row.visibility,
		title: row.title,
		body: row.body,
		authorUserId: row.authorUserId,
		authorDisplayName: row.author?.displayName ?? null,
		teamId: row.team?.id ?? null,
		teamName: row.team?.name ?? null,
		teamTag: row.team?.tag ?? null,
		organizationId: row.organization?.id ?? row.team?.organizationId ?? null,
		organizationName: row.organization?.name ?? null,
		organizationSlug: row.organization?.slug ?? null,
		canManage: params?.canManage ?? false,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
