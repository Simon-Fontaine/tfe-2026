import type {
	DomainAuditActionType,
	DomainAuditActorType,
	DomainAuditDomain,
} from "@scrimflow/shared";

import { db } from "@/db";
import { domainAuditEventTable } from "@/db/schema";
import logger from "@/utils/logger";

export function writeDomainAuditEvent(event: {
	actorId: string | null;
	actorType: DomainAuditActorType;
	domain: DomainAuditDomain;
	actionType: DomainAuditActionType;
	targetType?: string | null;
	targetId?: string | null;
	outcome?: string | null;
	reason?: string | null;
	metadata?: Record<string, unknown>;
	linkedCaseId?: string | null;
	linkedScrimId?: string | null;
}): void {
	db.insert(domainAuditEventTable)
		.values({
			actorId: event.actorId,
			actorType: event.actorType,
			domain: event.domain,
			actionType: event.actionType,
			targetType: event.targetType ?? null,
			targetId: event.targetId ?? null,
			outcome: event.outcome ?? null,
			reason: event.reason ?? null,
			metadata: event.metadata,
			linkedCaseId: event.linkedCaseId ?? null,
			linkedScrimId: event.linkedScrimId ?? null,
		})
		.catch((err: unknown) =>
			logger.error({ err, actionType: event.actionType }, "domain audit event write failed")
		);
}
