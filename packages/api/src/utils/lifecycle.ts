import type {
	LifecycleEntityType,
	LifecycleStatus,
	LifecycleVisibilityImpact,
	LifecycleWorkflowSummary,
} from "@scrimflow/shared";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { lifecycleWorkflowTable, organizationTable, teamTable } from "@/db/schema";

export const OPEN_LIFECYCLE_STATUSES = ["archived", "deletion_pending"] as const;
export const LIFECYCLE_RECOVERY_WINDOW_MS = 1_000 * 60 * 60 * 24 * 30;

export function lifecycleVisibilityImpact(status: LifecycleStatus): LifecycleVisibilityImpact[] {
	if (status === "active") return [];
	if (status === "archived") {
		return ["public_hidden", "active_workflows_suspended", "history_preserved"];
	}
	if (status === "deletion_pending") {
		return [
			"public_hidden",
			"workspace_read_only",
			"active_workflows_suspended",
			"history_preserved",
		];
	}
	return ["public_hidden", "workspace_read_only", "history_preserved"];
}

export function isOpenLifecycleStatus(status: string): boolean {
	return OPEN_LIFECYCLE_STATUSES.includes(status as (typeof OPEN_LIFECYCLE_STATUSES)[number]);
}

export function canCancelLifecycle(status: string, recoveryUntil: Date | null): boolean {
	return status === "deletion_pending" && Boolean(recoveryUntil && recoveryUntil > new Date());
}

export function canRunActiveLifecycleMutation(status: string | null | undefined): boolean {
	return !status || status === "active";
}

export function getLifecycleMutationBlockReason(
	entityLabel: string,
	status: string | null | undefined
) {
	if (canRunActiveLifecycleMutation(status)) return null;
	if (status === "archived") {
		return `${entityLabel} is archived. Restore it before making active workflow changes.`;
	}
	if (status === "deletion_pending") {
		return `${entityLabel} is deletion-pending. Only recovery, read-only, or settlement actions are available.`;
	}
	if (status === "irreversible") {
		return `${entityLabel} has reached an irreversible lifecycle state.`;
	}
	return `${entityLabel} is not active.`;
}

export function getLifecycleRecoveryUntil(now = new Date()): Date {
	return new Date(now.getTime() + LIFECYCLE_RECOVERY_WINDOW_MS);
}

export async function persistExpiredLifecycleWorkflows(
	entityType: LifecycleEntityType,
	entityId: string
) {
	// Settle the workflow and sync the entity status in one transaction so the column
	// can't stay deletion_pending after the recovery window expires.
	await db.transaction(async (tx) => {
		const expired = await tx
			.update(lifecycleWorkflowTable)
			.set({
				status: "irreversible",
				workflowState: "settled",
				result: "expired",
				settledAt: new Date(),
			})
			.where(
				and(
					eq(lifecycleWorkflowTable.entityType, entityType),
					eq(lifecycleWorkflowTable.entityId, entityId),
					eq(lifecycleWorkflowTable.status, "deletion_pending"),
					lt(lifecycleWorkflowTable.recoveryUntil, new Date())
				)
			)
			.returning({ id: lifecycleWorkflowTable.id });

		if (expired.length === 0) return;

		if (entityType === "organization") {
			await tx
				.update(organizationTable)
				.set({ lifecycleStatus: "irreversible", lifecycleUpdatedAt: new Date() })
				.where(eq(organizationTable.id, entityId));
		} else if (entityType === "team") {
			await tx
				.update(teamTable)
				.set({ lifecycleStatus: "irreversible", lifecycleUpdatedAt: new Date() })
				.where(eq(teamTable.id, entityId));
		}
	});
}

export async function getCurrentLifecycleWorkflow(
	entityType: LifecycleEntityType,
	entityId: string
) {
	await persistExpiredLifecycleWorkflows(entityType, entityId);

	const row = await db.query.lifecycleWorkflowTable.findFirst({
		where: and(
			eq(lifecycleWorkflowTable.entityType, entityType),
			eq(lifecycleWorkflowTable.entityId, entityId),
			inArray(lifecycleWorkflowTable.status, [...OPEN_LIFECYCLE_STATUSES])
		),
		orderBy: [desc(lifecycleWorkflowTable.createdAt)],
	});

	return row ?? null;
}

/**
 * P11: Returns the most recent lifecycle workflow row for the entity regardless of
 * current open/settled state. Use this when you need to surface the full lifecycle
 * history (e.g. an irreversible entity still has a workflow record to show).
 * Does NOT call persistExpiredLifecycleWorkflows — call that separately first.
 */
export async function getLatestLifecycleWorkflow(
	entityType: LifecycleEntityType,
	entityId: string
) {
	const row = await db.query.lifecycleWorkflowTable.findFirst({
		where: and(
			eq(lifecycleWorkflowTable.entityType, entityType),
			eq(lifecycleWorkflowTable.entityId, entityId)
		),
		orderBy: [desc(lifecycleWorkflowTable.createdAt)],
	});

	return row ?? null;
}

export function mapLifecycleWorkflow(
	row: NonNullable<Awaited<ReturnType<typeof getCurrentLifecycleWorkflow>>>
): LifecycleWorkflowSummary {
	const status = row.status as LifecycleStatus;
	return {
		id: row.id,
		entityType: row.entityType as LifecycleEntityType,
		entityId: row.entityId,
		action: row.action as LifecycleWorkflowSummary["action"],
		status,
		actorUserId: row.actorUserId,
		reason: row.reason,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		recoveryUntil: row.recoveryUntil?.toISOString() ?? null,
		settledAt: row.settledAt?.toISOString() ?? null,
		result: row.result,
		visibilityImpact: lifecycleVisibilityImpact(status),
	};
}
