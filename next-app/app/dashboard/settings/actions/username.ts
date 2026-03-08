"use server";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { rateLimits } from "@/lib/config/rate-limits";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";

export interface ActionResult {
	error?: string;
	success?: boolean;
}

export async function changeUsernameAction(username: string): Promise<ActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "Session expired. Please sign in again." };

	const { allowed, retryAfterMs } = await checkRateLimit(
		`change-username:${session.userId}`,
		rateLimits.changeUsername.limit,
		rateLimits.changeUsername.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	const trimmed = username.trim();

	if (trimmed.toLowerCase() === user.username.toLowerCase()) {
		return { error: "That is already your username." };
	}

	// Check uniqueness (case-insensitive)
	const existing = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(and(eq(userTable.username, trimmed), ne(userTable.id, session.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (existing) {
		return { error: "That username is already taken." };
	}

	await db.update(userTable).set({ username: trimmed }).where(eq(userTable.id, session.userId));

	return { success: true };
}
