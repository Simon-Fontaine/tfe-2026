import {
	appRoutes,
	CreatePlayerProfileSchema,
	OnboardingDraftSchema,
	type OnboardingProgress,
	type OnboardingProgressData,
} from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { heroTable, onboardingDraftTable, playerHeroTable, playerProfileTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const onboardingRoutes = new Hono<AuthEnv>();

function normalizeDraftData(data: unknown): OnboardingProgressData {
	if (!data || typeof data !== "object" || Array.isArray(data)) return {};
	const parsed = v.safeParse(OnboardingDraftSchema, data);
	if (!parsed.success) return {};
	const { currentStep: _currentStep, ...draftData } = parsed.output;
	return draftData;
}

function progressFromDraft(
	draft: { currentStep: string; data: unknown; updatedAt: Date } | undefined
): OnboardingProgress {
	if (!draft) return { currentStep: "battletag", data: {}, updatedAt: null };

	const parsed = v.safeParse(OnboardingDraftSchema, {
		currentStep: draft.currentStep,
		...normalizeDraftData(draft.data),
	});
	const currentStep = parsed.success ? (parsed.output.currentStep ?? "battletag") : "battletag";

	return {
		currentStep,
		data: normalizeDraftData(draft.data),
		updatedAt: draft.updatedAt.toISOString(),
	};
}

// GET /progress — Read server-backed onboarding draft
onboardingRoutes.get("/progress", async (c) => {
	const user = c.get("user");

	const draft = await db.query.onboardingDraftTable.findFirst({
		where: eq(onboardingDraftTable.userId, user.id),
		columns: { currentStep: true, data: true, updatedAt: true },
	});

	return c.json({ data: progressFromDraft(draft) });
});

// PATCH /progress — Upsert server-backed onboarding draft
onboardingRoutes.patch("/progress", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(OnboardingDraftSchema, body);
	if (!parsed.success) {
		return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	}

	const { currentStep = "battletag", ...draftData } = parsed.output;

	const [draft] = await db
		.insert(onboardingDraftTable)
		.values({
			userId: user.id,
			currentStep,
			data: draftData,
		})
		.onConflictDoUpdate({
			target: onboardingDraftTable.userId,
			set: {
				currentStep,
				data: draftData,
				updatedAt: new Date(),
			},
		})
		.returning({
			currentStep: onboardingDraftTable.currentStep,
			data: onboardingDraftTable.data,
			updatedAt: onboardingDraftTable.updatedAt,
		});

	return c.json({ data: progressFromDraft(draft) });
});

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
		participationIntent,
		availabilityIntent,
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
			participationIntent,
			availabilityIntent,
		});

		if (heroes.length > 0) {
			await tx
				.insert(playerHeroTable)
				.values(heroes.map((heroId) => ({ userId: user.id, heroId })));
		}

		await tx.delete(onboardingDraftTable).where(eq(onboardingDraftTable.userId, user.id));
	});

	return c.json({ redirect: appRoutes.root });
});

export { onboardingRoutes };
