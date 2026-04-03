import type { DiscoveryFilters, DiscoveryTeam } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type { DiscoveryFilters, DiscoveryTeam };

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getTeamsForDiscovery = cache(
	async (filters: DiscoveryFilters = {}): Promise<DiscoveryTeam[]> => {
		const params = new URLSearchParams();
		if (filters.recruiting !== undefined) params.set("recruiting", String(filters.recruiting));
		const qs = params.toString();
		const res = await apiGet<DiscoveryTeam[]>(`${apiRoutes.teams.publicRoot}${qs ? `?${qs}` : ""}`);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);
