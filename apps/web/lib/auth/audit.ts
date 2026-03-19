import { db } from "@/db";
import { auditLogTable } from "@/db/schema";
import logger from "@/lib/logger";

type AuditAction = (typeof auditLogTable.$inferInsert)["action"];

/** Fire-and-forget audit logging (fails open). */
export function writeAuditLog(
	userId: string,
	action: AuditAction,
	ipAddress: string | null,
	userAgent: string | null,
	geoCountry: string | null,
	geoCity: string | null,
	metadata?: Record<string, unknown>
): void {
	db.insert(auditLogTable)
		.values({ userId, action, ipAddress, userAgent, geoCountry, geoCity, metadata })
		.catch((err: unknown) => logger.error({ err, action }, "audit log write failed"));
}
