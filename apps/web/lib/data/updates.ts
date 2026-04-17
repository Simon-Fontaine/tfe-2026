import type { UpdatePostSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

function withQuery(path: string, params: Record<string, string | undefined>) {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value) searchParams.set(key, value);
	}

	const query = searchParams.toString();
	return query ? `${path}?${query}` : path;
}

export const getTeamUpdates = cache(async (teamId: string): Promise<UpdatePostSummary[]> => {
	const res = await apiGet<UpdatePostSummary[]>(withQuery(apiRoutes.updates.root, { teamId }));
	if ("data" in res) return res.data;
	if (res.status === 403 || res.status === 404) return [];
	throw new Error(res.error);
});

export const getPublicUpdates = cache(
	async (filters?: { teamId?: string; organizationId?: string }): Promise<UpdatePostSummary[]> => {
		const res = await apiGet<UpdatePostSummary[]>(
			withQuery(apiRoutes.updates.publicRoot, {
				teamId: filters?.teamId,
				organizationId: filters?.organizationId,
			})
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);
