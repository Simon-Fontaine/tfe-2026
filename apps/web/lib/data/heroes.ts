import type { HeroRow } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export type { HeroRow };

/**
 * Fetch active heroes, sorted by role then name.
 * Memoized per request with React's `cache()`.
 */
export const getActiveHeroes = cache(async (): Promise<HeroRow[]> => {
	const res = await apiGet<HeroRow[]>(apiRoutes.heroes.root);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});
