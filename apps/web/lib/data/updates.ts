import type { UpdatePostSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import {
	type RouteStateResult,
	routeStateMissing,
	routeStateNoAccess,
	routeStateSuccess,
} from "@/lib/route-state";
import { apiRoutes } from "@/lib/routes";

function withQuery(path: string, params: Record<string, string | undefined>) {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value) searchParams.set(key, value);
	}

	const query = searchParams.toString();
	return query ? `${path}?${query}` : path;
}

export const getTeamUpdates = cache(
	async (
		teamId: string,
		cursor?: string
	): Promise<{ posts: UpdatePostSummary[]; nextCursor: string | null }> => {
		const result = await getTeamUpdatesRouteState(teamId, cursor);
		if (result.kind === "success") return result.data;
		return { posts: [], nextCursor: null };
	}
);

export const getTeamUpdatesRouteState = cache(
	async (
		teamId: string,
		cursor?: string
	): Promise<RouteStateResult<{ posts: UpdatePostSummary[]; nextCursor: string | null }>> => {
		const res = await apiGet<UpdatePostSummary[]>(
			withQuery(apiRoutes.updates.root, { teamId, cursor })
		);
		if ("data" in res) {
			const paginated = res as unknown as { data: UpdatePostSummary[]; nextCursor: string | null };
			return routeStateSuccess({
				posts: paginated.data,
				nextCursor: paginated.nextCursor ?? null,
			});
		}
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess();
		throw new Error(res.error);
	}
);

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

export const getPublicUpdateById = cache(async (id: string): Promise<UpdatePostSummary | null> => {
	const res = await apiGet<UpdatePostSummary>(apiRoutes.updates.publicById(id));
	if ("data" in res) return res.data;
	if (res.status === 404) return null;
	throw new Error(res.error);
});
