"use server";

import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { sessionTable } from "@/db/schema";
import { writeAuditLog } from "@/lib/auth/audit";
import { extractClientContext } from "@/lib/auth/device";
import { deleteSessionTokenCookie, getCurrentSession, invalidateSession } from "@/lib/auth/session";
import { rateLimits } from "@/lib/config/rate-limits";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import type { ActionResult } from "./password";

export interface SessionInfo {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	geoCountry: string | null;
	geoCity: string | null;
	lastActiveAt: string;
	createdAt: string;
	isCurrent: boolean;
}

export async function getActiveSessionsAction(): Promise<SessionInfo[]> {
	const { session } = await getCurrentSession();
	if (!session) return [];

	const rows = await db
		.select({
			id: sessionTable.id,
			ipAddress: sessionTable.ipAddress,
			userAgent: sessionTable.userAgent,
			geoCountry: sessionTable.geoCountry,
			geoCity: sessionTable.geoCity,
			lastActiveAt: sessionTable.lastActiveAt,
			createdAt: sessionTable.createdAt,
		})
		.from(sessionTable)
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				isNull(sessionTable.revokedAt),
				gt(sessionTable.expiresAt, new Date())
			)
		)
		.orderBy(sessionTable.lastActiveAt);

	return rows.map((row) => ({
		id: row.id,
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		geoCountry: row.geoCountry,
		geoCity: row.geoCity,
		lastActiveAt: row.lastActiveAt.toISOString(),
		createdAt: row.createdAt.toISOString(),
		isCurrent: row.id === session.id,
	}));
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired." };

	// Rate limit: individual session revocation
	const { allowed, retryAfterMs } = await checkRateLimit(
		`session:revoke:${session.userId}`,
		rateLimits.sessionRevoke.limit,
		rateLimits.sessionRevoke.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	if (sessionId === session.id) {
		return { error: "Use the logout button to end your current session." };
	}

	const target = await db
		.select({ userId: sessionTable.userId })
		.from(sessionTable)
		.where(
			and(
				eq(sessionTable.id, sessionId),
				eq(sessionTable.userId, session.userId),
				isNull(sessionTable.revokedAt)
			)
		)
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!target) return { error: "Session not found." };

	await invalidateSession(sessionId, "manual_logout");

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	writeAuditLog(session.userId, "logout", client.ip, client.userAgent, null, null, {
		revokedSessionId: sessionId,
	});

	return { success: true };
}

export async function revokeAllOtherSessionsAction(): Promise<ActionResult> {
	const { session } = await getCurrentSession();
	if (!session) return { error: "Session expired." };

	// Rate limit: bulk session revocation
	const { allowed, retryAfterMs } = await checkRateLimit(
		`session:revoke-all:${session.userId}`,
		rateLimits.sessionRevokeAll.limit,
		rateLimits.sessionRevokeAll.windowMs
	);
	if (!allowed) {
		return {
			error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
		};
	}

	await db
		.update(sessionTable)
		.set({ revokedAt: new Date(), revocationReason: "logout_all_devices" })
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		);

	const requestHeaders = await headers();
	const client = extractClientContext(requestHeaders);
	writeAuditLog(
		session.userId,
		"logout_all_devices",
		client.ip,
		client.userAgent,
		null,
		null,
		undefined
	);

	return { success: true };
}

export async function logoutAction(): Promise<void> {
	const { session } = await getCurrentSession();
	if (!session) redirect("/");

	await invalidateSession(session.id, "manual_logout");
	await deleteSessionTokenCookie();
	redirect("/");
}
