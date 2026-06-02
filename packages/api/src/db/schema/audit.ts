import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./auth";

import {
	auditActionEnum,
	domainAuditActionTypeEnum,
	domainAuditActorTypeEnum,
	domainAuditDomainEnum,
} from "./enums";
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

// DOMAIN AUDIT EVENT — Cross-domain governance trail (append-only)

export const domainAuditEventTable = pgTable(
	"domain_audit_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Nullable — system/worker events have no user actor.
		 *  No FK: preserves the trail when actor accounts are deleted. */
		actorId: uuid("actor_id"),
		actorType: domainAuditActorTypeEnum("actor_type").notNull().default("user"),
		domain: domainAuditDomainEnum("domain").notNull(),
		actionType: domainAuditActionTypeEnum("action_type").notNull(),
		/** Polymorphic target type (e.g. "team", "organization", "scrim", "user"). */
		targetType: text("target_type"),
		/** Polymorphic target ID. No FK. */
		targetId: uuid("target_id"),
		/** "success" | "failure" | "blocked" | "partial" */
		outcome: text("outcome"),
		/** Human-readable reason or context. */
		reason: text("reason"),
		/** Action-specific JSONB context. */
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		/** Advisory link to related moderation case. No FK. */
		linkedCaseId: uuid("linked_case_id"),
		/** Advisory link to related scrim. No FK. */
		linkedScrimId: uuid("linked_scrim_id"),
		/** Immutable — no updatedAt. */
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("domain_audit_event_actor_idx").on(table.actorId, table.createdAt),
		index("domain_audit_event_domain_idx").on(table.domain, table.actionType, table.createdAt),
		index("domain_audit_event_target_idx").on(table.targetType, table.targetId, table.createdAt),
		index("domain_audit_event_case_idx").on(table.linkedCaseId),
		index("domain_audit_event_scrim_idx").on(table.linkedScrimId),
		index("domain_audit_event_created_idx").on(table.createdAt),
	]
);
