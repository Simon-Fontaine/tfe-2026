import {
	canManageOrg,
	canManageTeam,
	type OrgRole,
	type TeamPermissionRole,
} from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizationMemberTable, teamRosterTable, teamTable } from "@/db/schema";

export type TeamAccessContext = {
	teamId: string;
	organizationId: string;
	orgRole: OrgRole | null;
	teamMemberId: string | null;
	teamPermissionRole: TeamPermissionRole | null;
	teamStatus: string | null;
	canManageTeam: boolean;
};

export async function getOrgIdForTeam(teamId: string): Promise<string | null> {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
	});
	return team?.organizationId ?? null;
}

export async function getTeamById(teamId: string) {
	return db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			bannerUrl: true,
			rating: true,
			matchesPlayed: true,
			isRecruiting: true,
			isArchived: true,
			lifecycleStatus: true,
			isPublic: true,
		},
	});
}

export async function verifyTeamBelongsToOrg(teamId: string, orgId: string): Promise<boolean> {
	const team = await db.query.teamTable.findFirst({
		where: and(eq(teamTable.id, teamId), eq(teamTable.organizationId, orgId)),
		columns: { id: true },
	});
	return Boolean(team);
}

export async function getTeamAccessContext(
	teamId: string,
	userId: string
): Promise<TeamAccessContext | null> {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { id: true, organizationId: true },
	});
	if (!team) return null;

	const [orgMembership, teamMembership] = await Promise.all([
		db.query.organizationMemberTable.findFirst({
			where: and(
				eq(organizationMemberTable.organizationId, team.organizationId),
				eq(organizationMemberTable.userId, userId)
			),
			columns: { role: true },
		}),
		db.query.teamRosterTable.findFirst({
			where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
			columns: { id: true, permissionRole: true, status: true },
		}),
	]);

	const orgRole = (orgMembership?.role as OrgRole | undefined) ?? null;
	const teamPermissionRole =
		(teamMembership?.permissionRole as TeamPermissionRole | undefined) ?? null;
	const isActiveTeamMember = !!teamMembership && teamMembership.status !== "inactive";

	return {
		teamId: team.id,
		organizationId: team.organizationId,
		orgRole,
		teamMemberId: teamMembership?.id ?? null,
		teamPermissionRole,
		teamStatus: teamMembership?.status ?? null,
		canManageTeam:
			canManageOrg(orgRole) || (isActiveTeamMember && canManageTeam(orgRole, teamPermissionRole)),
	};
}

export async function verifyTeamManager(teamId: string, userId: string): Promise<boolean> {
	const ctx = await getTeamAccessContext(teamId, userId);
	return ctx?.canManageTeam ?? false;
}

export async function isUserOnTeam(userId: string, teamId: string): Promise<boolean> {
	const row = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { status: true },
	});
	return !!row && row.status !== "inactive";
}

export async function listTeamAdminUserIds(teamId: string): Promise<string[]> {
	const rows = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.permissionRole, "admin")),
		columns: { userId: true, status: true },
	});

	return [...new Set(rows.filter((row) => row.status !== "inactive").map((row) => row.userId))];
}

export async function listTeamWorkspaceUserIds(teamId: string): Promise<string[]> {
	const rows = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.teamId, teamId)),
		columns: { userId: true, status: true },
	});

	return [
		...new Set(
			rows
				.filter(
					(row) => row.status === "active" || row.status === "benched" || row.status === "trial"
				)
				.map((row) => row.userId)
		),
	];
}

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

export async function getOrgIdForRoster(
	memberId: string
): Promise<{ orgId: string; teamId: string } | null> {
	const row = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, memberId),
		columns: { teamId: true },
	});
	if (!row) return null;
	const orgId = await getOrgIdForTeam(row.teamId);
	if (!orgId) return null;
	return { orgId, teamId: row.teamId };
}
