import { cache } from "react";

import { apiGet } from "@/lib/api-client";

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

export const getTeamsForDiscovery = cache(
	async (filters: DiscoveryFilters = {}): Promise<DiscoveryTeam[]> => {
		const params = new URLSearchParams();
		if (filters.recruiting !== undefined) params.set("recruiting", String(filters.recruiting));
		if (filters.region) params.set("region", filters.region);
		const qs = params.toString();
		const res = await apiGet<DiscoveryTeam[]>(`/api/teams${qs ? `?${qs}` : ""}`);
		if ("data" in res) return res.data;
		return [];
	}
);
