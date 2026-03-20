import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { heroTable } from "@/db/schema";

const heroRoutes = new Hono();

// GET / — List active heroes (public, no auth required)
heroRoutes.get("/", async (c) => {
	const heroes = await db.query.heroTable.findMany({
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

	return c.json({ data: heroes });
});

export { heroRoutes };
