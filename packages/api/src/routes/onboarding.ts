import { appRoutes, CreatePlayerProfileSchema } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { heroTable, playerHeroTable, playerProfileTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const onboardingRoutes = new Hono<AuthEnv>();

// POST /profile — Create initial player profile
onboardingRoutes.post("/profile", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	// Idempotency: if a profile already exists just redirect
	const existing = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (existing) return c.json({ redirect: appRoutes.root });

	const parsed = v.safeParse(CreatePlayerProfileSchema, body);
	if (!parsed.success) {
		return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	}

	const {
		battletag,
		primaryRole,
		secondaryRole,
		rank,
		rankDivision,
		heroPool: heroes,
	} = parsed.output;

	// Validate hero IDs against active registry
	const activeHeroes = await db.query.heroTable.findMany({
		where: eq(heroTable.isActive, true),
		columns: { id: true },
	});
	const validIds = new Set(activeHeroes.map((h) => h.id));
	const invalidHeroes = heroes.filter((id) => !validIds.has(id));
	if (invalidHeroes.length > 0) {
		return c.json({ error: "Your hero pool contains unrecognised heroes. Please try again." }, 400);
	}

	const effectiveDivision = !rank ? null : (rankDivision ?? null);

	await db.transaction(async (tx) => {
		await tx.insert(playerProfileTable).values({
			userId: user.id,
			battletag: battletag ?? null,
			primaryRole,
			secondaryRole: secondaryRole ?? null,
			rank: rank ?? null,
			rankDivision: effectiveDivision,
		});

		if (heroes.length > 0) {
			await tx
				.insert(playerHeroTable)
				.values(heroes.map((heroId) => ({ userId: user.id, heroId })));
		}
	});

	return c.json({ redirect: appRoutes.root });
});

export { onboardingRoutes };
