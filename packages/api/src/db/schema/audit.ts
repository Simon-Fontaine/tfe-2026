import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./auth";

import { auditActionEnum } from "./enums";
// ============================================================================
// AUDIT LOG — Immutable security event trail

/**
 * Append-only, immutable log of every security-relevant event on the platform.
 * Never updated or deleted (except by GDPR cascade). `metadata` is JSONB for
 * action-specific context. No foreign keys beyond `userId` so audit entries
 * remain stable across schema changes.
 */
export const auditLogTable = pgTable(
	"audit_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		action: auditActionEnum("action").notNull(),

		/** Client IP at event time. */
		ipAddress: text("ip_address"),

		/** User-Agent at event time. */
		userAgent: text("user_agent"),

		/** GeoIP country code at event time. */
		geoCountry: text("geo_country"),

		/** GeoIP city at event time. */
		geoCity: text("geo_city"),

		/** Action-specific context as JSONB. */
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),

		/** Immutable — no updatedAt. */
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// "My security activity log" — paginated by time
		index("audit_log_user_idx").on(table.userId, table.createdAt),
		// "All failed logins in the last hour" — rate limiting / brute-force detection
		index("audit_log_action_idx").on(table.action, table.createdAt),
		// "All events from this IP" — abuse investigation
		index("audit_log_ip_idx").on(table.ipAddress, table.createdAt),
	]
);
