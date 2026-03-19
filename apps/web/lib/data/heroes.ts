import { asc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { heroTable } from "@/db/schema";

/** Minimal hero data needed by the UI. */
export type HeroRow = {
	id: string;
	displayName: string;
	role: "tank" | "damage" | "support";
	imageUrl: string | null;
	description: string | null;
};

/**
 * Fetch active heroes from the DB, sorted by role then name.
 * Memoized per request with React's `cache()`.
 */
export const getActiveHeroes = cache(async (): Promise<HeroRow[]> => {
	return db.query.heroTable.findMany({
		where: eq(heroTable.isActive, true),
		columns: {
			id: true,
			displayName: true,
			role: true,
			imageUrl: true,
			description: true,
		},
		orderBy: [asc(heroTable.role), asc(heroTable.displayName)],
	});
});
