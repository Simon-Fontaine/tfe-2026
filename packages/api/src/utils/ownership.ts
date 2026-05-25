import type { OwnershipWorkflowSummary } from "@scrimflow/shared";
import { and, asc, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
	organizationMemberTable,
	ownershipWorkflowTable,
	teamRosterTable,
	teamTable,
	userTable,
} from "@/db/schema";

const OPEN_OWNERSHIP_STATUSES = ["pending", "review_required", "blocked"] as const;

const SETTLED_OWNERSHIP_STATUSES = [
	"accepted",
	"approved",
	"rejected",
	"cancelled",
	"expired",
] as const;

type OwnershipStatus =
	| (typeof OPEN_OWNERSHIP_STATUSES)[number]
	| (typeof SETTLED_OWNERSHIP_STATUSES)[number];

export function isOpenOwnershipStatus(status: string): boolean {
	return OPEN_OWNERSHIP_STATUSES.includes(status as (typeof OPEN_OWNERSHIP_STATUSES)[number]);
}

export function getOwnershipStatusCopy(status: string) {
	switch (status) {
		case "pending":
			return "Pending recipient verification";
		case "accepted":
			return "Accepted and settling";
		case "rejected":
			return "Rejected";
		case "cancelled":
			return "Cancelled";
		case "expired":
			return "Expired";
		case "review_required":
			return "Recovery review required";
		case "approved":
			return "Approved";
		case "blocked":
			return "Blocked by continuity policy";
		default:
			return "Unknown ownership state";
	}
}

export async function getCurrentOwnershipWorkflow(
	entityType: "organization" | "team",
	entityId: string
) {
	await persistExpiredOwnershipWorkflows(entityType, entityId);

	const row = await db.query.ownershipWorkflowTable.findFirst({
		where: and(
			eq(ownershipWorkflowTable.entityType, entityType),
			eq(ownershipWorkflowTable.entityId, entityId),
			inArray(ownershipWorkflowTable.status, [...OPEN_OWNERSHIP_STATUSES])
		),
		orderBy: [desc(ownershipWorkflowTable.createdAt)],
		with: {
			requester: { columns: { id: true, displayName: true } },
			currentOwner: { columns: { id: true, displayName: true } },
			recipient: { columns: { id: true, displayName: true } },
			recoveryTarget: { columns: { id: true, displayName: true } },
		},
	});

	return row ?? null;
}

export async function persistExpiredOwnershipWorkflows(
	entityType: "organization" | "team",
	entityId: string
) {
	await db
		.update(ownershipWorkflowTable)
		.set({ status: "expired", result: "expired", resolvedAt: new Date() })
		.where(
			and(
				eq(ownershipWorkflowTable.entityType, entityType),
				eq(ownershipWorkflowTable.entityId, entityId),
				inArray(ownershipWorkflowTable.status, ["pending", "review_required"]),
				lt(ownershipWorkflowTable.expiresAt, new Date())
			)
		);
}

export function mapOwnershipWorkflow(
	row: NonNullable<Awaited<ReturnType<typeof getCurrentOwnershipWorkflow>>>,
	visibility: "authorized" | "limited"
): OwnershipWorkflowSummary {
	return {
		id: row.id,
		entityType: row.entityType as "team" | "organization",
		entityId: row.entityId,
		kind: row.kind as "transfer" | "recovery",
		status: row.status as OwnershipStatus,
		requester: {
			userId: row.requester?.id ?? row.requesterUserId,
			displayName: row.requester?.displayName ?? null,
		},
		currentOwner: {
			userId: row.currentOwner?.id ?? row.currentOwnerUserId,
			displayName: row.currentOwner?.displayName ?? null,
		},
		recipient: row.recipientUserId
			? {
					userId: row.recipient?.id ?? row.recipientUserId,
					displayName: row.recipient?.displayName ?? null,
				}
			: null,
		recoveryTarget: row.recoveryTargetUserId
			? {
					userId: row.recoveryTarget?.id ?? row.recoveryTargetUserId,
					displayName: row.recoveryTarget?.displayName ?? null,
				}
			: null,
		verificationState: row.verificationState as OwnershipWorkflowSummary["verificationState"],
		reviewState: row.reviewState as OwnershipWorkflowSummary["reviewState"],
		reason: visibility === "authorized" ? row.reason : null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		expiresAt: row.expiresAt?.toISOString() ?? null,
		resolvedAt: row.resolvedAt?.toISOString() ?? null,
		result: row.result as OwnershipWorkflowSummary["result"],
		visibility,
	};
}

export async function hasOtherActiveOrgOwnerMembership(orgId: string, ownerUserId: string) {
	const row = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			ne(organizationMemberTable.userId, ownerUserId),
			eq(organizationMemberTable.role, "owner")
		),
		columns: { id: true },
	});
	return Boolean(row);
}

export async function getPrimaryTeamContinuityOwner(teamId: string) {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
		with: {
			roster: {
				where: and(
					eq(teamRosterTable.permissionRole, "admin"),
					ne(teamRosterTable.status, "inactive")
				),
				columns: { userId: true },
				// P14: deterministic ordering so the most-senior admin is always selected
				orderBy: [asc(teamRosterTable.joinedAt)],
			},
		},
	});
	if (!team) return null;

	const teamAdmin = team.roster[0]?.userId ?? null;
	if (teamAdmin) return teamAdmin;

	const orgOwner = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, team.organizationId),
			eq(organizationMemberTable.role, "owner")
		),
		columns: { userId: true },
	});
	return orgOwner?.userId ?? null;
}

/**
 * P19: Maps a resolution decision to the workflow status/reviewState/result triple.
 * Previously duplicated in both orgs.ts and teams/index.ts — canonical home is here.
 */
export function getOwnershipResolution(result: "approve" | "reject" | "block") {
	if (result === "approve") {
		return { status: "approved", reviewState: "approved", workflowResult: "recovered" };
	}
	if (result === "block") {
		return { status: "blocked", reviewState: "rejected", workflowResult: "blocked" };
	}
	return { status: "rejected", reviewState: "rejected", workflowResult: "rejected" };
}

export async function isActiveTeamAdmin(teamId: string, userId: string) {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(
			eq(teamRosterTable.teamId, teamId),
			eq(teamRosterTable.userId, userId),
			eq(teamRosterTable.permissionRole, "admin"),
			ne(teamRosterTable.status, "inactive")
		),
		columns: { id: true },
	});
	return Boolean(row);
}

export async function getUserDisplayName(userId: string | null | undefined) {
	if (!userId) return null;
	const row = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: { displayName: true },
	});
	return row?.displayName ?? null;
}
