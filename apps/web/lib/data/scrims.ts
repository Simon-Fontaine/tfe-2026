import type { OcrJobSummary, ScrimDetail, ScrimSummary } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type { OcrJobSummary, ScrimDetail, ScrimSummary };

export const getTeamScrims = cache(async (teamId: string): Promise<ScrimSummary[]> => {
	const res = await apiGet<ScrimSummary[]>(
		`${apiRoutes.scrims.root}?teamId=${encodeURIComponent(teamId)}`
	);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getScrimById = cache(async (scrimId: string): Promise<ScrimDetail | null> => {
	const res = await apiGet<ScrimDetail>(apiRoutes.scrims.byId(scrimId));
	if ("data" in res) return res.data;
	if (res.status === 404) return null;
	throw new Error(res.error);
});

export const getPublicScrims = cache(async (): Promise<ScrimSummary[]> => {
	const res = await apiGet<ScrimSummary[]>(apiRoutes.scrims.publicRoot);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});
