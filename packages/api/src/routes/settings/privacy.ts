import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { playerProfileTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const ALLOWED_VISIBILITY = ["public", "teams_only", "private"] as const;
const VisibilitySchema = v.picklist(ALLOWED_VISIBILITY);
const PrivacyBodySchema = v.object({ profileVisibility: VisibilitySchema });

const privacyRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET / — return current profile visibility
privacyRoutes.get("/", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ profileVisibility: playerProfileTable.profileVisibility })
		.from(playerProfileTable)
		.where(eq(playerProfileTable.userId, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return c.json({ data: { profileVisibility: row?.profileVisibility ?? "public" } });
});

// PUT / — save profile visibility
privacyRoutes.put("/", async (c) => {
	const session = c.get("session");
	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(PrivacyBodySchema, body);
	if (!parsed.success) return c.json({ error: "Invalid visibility value." }, 400);
	await db
		.update(playerProfileTable)
		.set({ profileVisibility: parsed.output.profileVisibility })
		.where(eq(playerProfileTable.userId, session.userId));
	return c.json({ success: true });
});

export { privacyRoutes };

// Data export route — mounted separately at /data-export in settings/index.ts
const dataExportRoute = new Hono<RequestContextEnv & AuthEnv>();

dataExportRoute.get("/", async (c) => {
	const session = c.get("session");
	const [user, profile] = await Promise.all([
		db
			.select({
				id: userTable.id,
				email: userTable.email,
				username: userTable.username,
				displayName: userTable.displayName,
				createdAt: userTable.createdAt,
			})
			.from(userTable)
			.where(eq(userTable.id, session.userId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		db
			.select({
				primaryRole: playerProfileTable.primaryRole,
				rank: playerProfileTable.rank,
				battletag: playerProfileTable.battletag,
				profileVisibility: playerProfileTable.profileVisibility,
			})
			.from(playerProfileTable)
			.where(eq(playerProfileTable.userId, session.userId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
	]);
	const exportData = { exportedAt: new Date().toISOString(), user, profile };
	c.header("Content-Type", "application/json");
	c.header("Content-Disposition", 'attachment; filename="scrimflow-data-export.json"');
	return c.body(JSON.stringify(exportData, null, 2));
});

export { dataExportRoute };
