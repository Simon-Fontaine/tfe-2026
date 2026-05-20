import {
	type MandatoryNotificationPolicy,
	NotificationPreferenceSchema,
	type NotificationPreferenceSettings,
} from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { extractErrors } from "@/routes/auth/utils";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSettings = {
	invites: true,
	applications: true,
	scrimChanges: true,
	chatActivity: true,
	results: true,
	disputes: true,
	updates: true,
};

export const MANDATORY_NOTIFICATION_POLICY: MandatoryNotificationPolicy = {
	accountLifecycle: true,
	securityCritical: true,
	moderationCritical: true,
};

const notificationPreferencesRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET / — return current preferences for the authenticated user
notificationPreferencesRoutes.get("/", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ notificationPreferences: userTable.notificationPreferences })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);
	return c.json({
		data: {
			optional: {
				...DEFAULT_NOTIFICATION_PREFERENCES,
				...(row?.notificationPreferences ?? {}),
			},
			mandatory: MANDATORY_NOTIFICATION_POLICY,
		},
	});
});

async function updateNotificationPreferences(c: Context<RequestContextEnv & AuthEnv>) {
	const session = c.get("session");
	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(NotificationPreferenceSchema, body);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid notification preferences.", fieldErrors: extractErrors(parsed.issues) },
			400
		);
	}
	await db
		.update(userTable)
		.set({ notificationPreferences: parsed.output })
		.where(eq(userTable.id, session.userId));
	return c.json({ success: true });
}

notificationPreferencesRoutes.put("/", updateNotificationPreferences);
notificationPreferencesRoutes.patch("/", updateNotificationPreferences);

export { notificationPreferencesRoutes };
