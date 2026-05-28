import type { OcrJobSummary, ScrimDetail, ScrimSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import {
	type RouteStateResult,
	routeStateMissing,
	routeStateNoAccess,
	routeStateSuccess,
} from "@/lib/route-state";
import { apiRoutes } from "@/lib/routes";

export type { OcrJobSummary, ScrimDetail, ScrimSummary };

export const getTeamScrims = cache(
	async (
		teamId: string,
		pastCursor?: string
	): Promise<{ scrims: ScrimSummary[]; nextCursor: string | null }> => {
		const result = await getTeamScrimsRouteState(teamId, pastCursor);
		if (result.kind === "success") return result.data;
		return { scrims: [], nextCursor: null };
	}
);

export const getTeamScrimsRouteState = cache(
	async (
		teamId: string,
		pastCursor?: string
	): Promise<RouteStateResult<{ scrims: ScrimSummary[]; nextCursor: string | null }>> => {
		const url = pastCursor
			? `${apiRoutes.scrims.root}?teamId=${encodeURIComponent(teamId)}&cursor=${encodeURIComponent(pastCursor)}&limit=20`
			: `${apiRoutes.scrims.root}?teamId=${encodeURIComponent(teamId)}&limit=20`;
		const res = await apiGet<ScrimSummary[]>(url);
		if ("data" in res) {
			const paginated = res as unknown as { data: ScrimSummary[]; nextCursor: string | null };
			return routeStateSuccess({
				scrims: paginated.data,
				nextCursor: paginated.nextCursor ?? null,
			});
		}
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess(res.reason);
		throw new Error(res.error);
	}
);

export const getScrimById = cache(async (scrimId: string): Promise<ScrimDetail | null> => {
	const result = await getScrimRouteState(scrimId);
	return result.kind === "success" ? result.data : null;
});

export const getScrimRouteState = cache(
	async (scrimId: string): Promise<RouteStateResult<ScrimDetail>> => {
		const res = await apiGet<ScrimDetail>(apiRoutes.scrims.byId(scrimId));
		if ("data" in res) return routeStateSuccess(res.data);
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess(res.reason);
		throw new Error(res.error);
	}
);

export const getPublicScrims = cache(async (): Promise<ScrimSummary[]> => {
	const res = await apiGet<ScrimSummary[]>(apiRoutes.scrims.publicRoot);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});
