import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { teamRosterTable, teamTable } from "@/db/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DiscoveryTeam = {
	id: string;
	organizationId: string;
	name: string;
	tag: string;
	description: string | null;
	avatarUrl: string | null;
	teamSr: number;
	isRecruiting: boolean;
	activeRosterCount: number;
};

export type DiscoveryFilters = {
	recruiting?: boolean;
	region?: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns non-archived teams for the discovery feed.
 * Optionally filter to recruiting-only teams.
 * Memoized per request.
 */
export const getTeamsForDiscovery = cache(
	async (filters: DiscoveryFilters = {}): Promise<DiscoveryTeam[]> => {
		const teams = await db.query.teamTable.findMany({
			where: and(
				eq(teamTable.isArchived, false),
				filters.recruiting !== undefined
					? eq(teamTable.isRecruiting, filters.recruiting)
					: undefined
			),
			columns: {
				id: true,
				organizationId: true,
				name: true,
				tag: true,
				description: true,
				avatarUrl: true,
				teamSr: true,
				isRecruiting: true,
			},
			with: {
				roster: {
					where: eq(teamRosterTable.status, "active"),
					columns: { id: true },
				},
			},
			orderBy: [asc(teamTable.name)],
			limit: 60,
		});

		return teams.map((t) => ({
			id: t.id,
			organizationId: t.organizationId,
			name: t.name,
			tag: t.tag,
			description: t.description ?? null,
			avatarUrl: t.avatarUrl,
			teamSr: t.teamSr,
			isRecruiting: t.isRecruiting,
			activeRosterCount: t.roster.length,
		}));
	}
);
