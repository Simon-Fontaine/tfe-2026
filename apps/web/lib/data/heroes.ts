import { cache } from "react";

import { apiGet } from "@/lib/api-client";

/** Minimal hero data needed by the UI. */
export type HeroRow = {
	id: string;
	displayName: string;
	role: "tank" | "damage" | "support";
	imageUrl: string | null;
	description: string | null;
};

/**
 * Fetch active heroes, sorted by role then name.
 * Memoized per request with React's `cache()`.
 */
export const getActiveHeroes = cache(async (): Promise<HeroRow[]> => {
	const res = await apiGet<HeroRow[]>("/api/heroes");
	if ("data" in res) return res.data;
	return [];
});
