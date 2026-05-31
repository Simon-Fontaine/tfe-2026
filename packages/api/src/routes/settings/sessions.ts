import { rateLimits } from "@scrimflow/shared";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { writeAuditLog } from "@/auth/audit";
import { invalidateSession } from "@/auth/session";
import { db } from "@/db";
import { sessionTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { createNotification } from "@/notifications";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { disconnectChatSession } from "@/realtime/chat-hub";
import { disconnectRealtimeSession } from "@/realtime/scrim-hub";
import logger from "@/utils/logger";

const sessionRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET / — List active sessions
sessionRoutes.get("/", async (c) => {
	const session = c.get("session");

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

	return c.json({
		data: rows.map((row) => ({
			id: row.id,
			ipAddress: row.ipAddress,
			userAgent: row.userAgent,
			geoCountry: row.geoCountry,
			geoCity: row.geoCity,
			lastActiveAt: row.lastActiveAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			isCurrent: row.id === session.id,
		})),
	});
});

// DELETE /:id — Revoke a specific session
sessionRoutes.delete("/:id", async (c) => {
	const session = c.get("session");
	const sessionId = c.req.param("id");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`session:revoke:${session.userId}`,
		rateLimits.sessionRevoke.limit,
		rateLimits.sessionRevoke.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	if (sessionId === session.id) {
		return c.json({ error: "Use the logout button to end your current session." }, 400);
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

	if (!target) return c.json({ error: "Session not found." }, 404);

	await invalidateSession(sessionId, "manual_logout");
	disconnectRealtimeSession(sessionId, "session_revoked");
	disconnectChatSession(sessionId, "session_revoked");

	createNotification({
		userId: session.userId,
		type: "session_revoked_alert",
		title: "A session was signed out",
		body: "You signed out another active session from your account.",
	}).catch((err: unknown) => logger.error({ err }, "session revoke notification failed"));

	const client = c.get("client");
	writeAuditLog(session.userId, "logout", client.ip, client.userAgent, null, null, {
		revokedSessionId: sessionId,
	});

	return c.json({ success: true });
});

// DELETE / — Revoke all other sessions
sessionRoutes.delete("/", async (c) => {
	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`session:revoke-all:${session.userId}`,
		rateLimits.sessionRevokeAll.limit,
		rateLimits.sessionRevokeAll.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const revokedSessionIds = await db
		.select({ id: sessionTable.id })
		.from(sessionTable)
		.where(
			and(
				eq(sessionTable.userId, session.userId),
				ne(sessionTable.id, session.id),
				isNull(sessionTable.revokedAt)
			)
		)
		.then((rows) => rows.map((row) => row.id));

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

	for (const revokedSessionId of revokedSessionIds) {
		disconnectRealtimeSession(revokedSessionId, "session_revoked");
		disconnectChatSession(revokedSessionId, "session_revoked");
	}

	const client = c.get("client");
	writeAuditLog(
		session.userId,
		"logout_all_devices",
		client.ip,
		client.userAgent,
		null,
		null,
		undefined
	);

	return c.json({ success: true });
});

// POST /logout — Full logout (current session)
sessionRoutes.post("/logout", async (c) => {
	const session = c.get("session");

	await invalidateSession(session.id, "manual_logout");
	disconnectRealtimeSession(session.id, "session_revoked");
	disconnectChatSession(session.id, "session_revoked");
	deleteCookie(c, "session_token", { path: "/" });

	return c.json({ success: true });
});

export { sessionRoutes };
