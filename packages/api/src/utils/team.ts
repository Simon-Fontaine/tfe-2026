import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamRosterTable, teamTable } from "@/db/schema";

/**
 * Checks whether a user is an active member of a team.
 */
export async function verifyUserOnTeam(userId: string, teamId: string): Promise<boolean> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(
			eq(teamRosterTable.userId, userId),
			eq(teamRosterTable.teamId, teamId),
			eq(teamRosterTable.status, "active")
		),
		columns: { id: true },
	});
	return row !== undefined;
}

/**
 * Checks whether a user is an active/trial/benched member of a team (any non-inactive status).
 */
export async function isUserOnTeam(userId: string, teamId: string): Promise<boolean> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { status: true },
	});
	return !!row && row.status !== "inactive";
}

/**
 * Gets the organization ID for a given team.
 */
export async function getOrgIdForTeam(teamId: string): Promise<string | null> {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
	});
	return team?.organizationId ?? null;
}

export async function verifyTeamBelongsToOrg(teamId: string, orgId: string): Promise<boolean> {
	const team = await db.query.teamTable.findFirst({
		where: and(eq(teamTable.id, teamId), eq(teamTable.organizationId, orgId)),
		columns: { id: true },
	});
	return Boolean(team);
}

/**
 * Gets the organization ID and team ID from a roster entry.
 */
export async function getOrgIdForRoster(
	rosterId: string
): Promise<{ orgId: string; teamId: string } | null> {
	const row = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, rosterId),
		columns: { teamId: true },
	});
	if (!row) return null;
	const orgId = await getOrgIdForTeam(row.teamId);
	if (!orgId) return null;
	return { orgId, teamId: row.teamId };
}
