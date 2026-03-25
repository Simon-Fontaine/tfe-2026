import type {
	LfgApplicationSummary,
	LfgFilters,
	LfgPostSummary,
	UserApplicationSummary,
} from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type { LfgApplicationSummary, LfgFilters, LfgPostSummary, UserApplicationSummary };

// ─── Queries ───────────────────────────────────────────────────────────────────

export const getOpenLfgPosts = cache(
	async (filters: LfgFilters = {}): Promise<LfgPostSummary[]> => {
		const params = new URLSearchParams();
		if (filters.type) params.set("type", filters.type);
		if (filters.role) params.set("role", filters.role);
		if (filters.region) params.set("region", filters.region);
		const qs = params.toString();
		const res = await apiGet<LfgPostSummary[]>(`${apiRoutes.lfg.root}${qs ? `?${qs}` : ""}`);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export async function getTeamApplications(teamId: string): Promise<LfgApplicationSummary[]> {
	const res = await apiGet<LfgApplicationSummary[]>(apiRoutes.teams.applications(teamId));
	if ("data" in res) return res.data;
	throw new Error(res.error);
}

export const getUserApplications = cache(
	async (_userId: string): Promise<UserApplicationSummary[]> => {
		const res = await apiGet<UserApplicationSummary[]>(apiRoutes.lfg.applications);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export async function getLfgPostsForTeam(teamId: string) {
	const res = await apiGet<LfgPostSummary[]>(apiRoutes.teams.lfg(teamId));
	if ("data" in res) return res.data;
	throw new Error(res.error);
}
