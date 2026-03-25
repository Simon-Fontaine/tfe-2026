import {
	ArchiveTeamSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	ToggleRecruitingSchema,
	UpdateTeamSchema,
} from "@scrimflow/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	lfgApplicationTable,
	lfgPostTable,
	organizationMemberTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { createTeamIdInviteRoutes, teamInviteRoutes } from "@/routes/teams/invites";
import { rosterRoutes } from "@/routes/teams/roster";
import { getUserOrgRole, verifyOrgManager } from "@/utils/org";
import { verifyTeamBelongsToOrg } from "@/utils/team";

const teamRoutes = new Hono<AuthEnv>();

// Mount sub-routes (must be before /:id to avoid conflict)
teamRoutes.route("/invites", teamInviteRoutes);

// GET / — Discovery: list non-archived teams
teamRoutes.get("/", async (c) => {
	/**
	 * Discovery API contract:
	 * - `recruiting` is the only supported query param for team discovery today.
	 * - Accepted values are the string literals `"true"` and `"false"`.
	 * - Unknown params (for example `region`) are intentionally ignored.
	 *
	 * If we add new filter dimensions in the future, update this parser and the
	 * shared `DiscoveryFilters` type in the same change to keep UI/backend behavior
	 * aligned.
	 */
	const recruiting = c.req.query("recruiting");
	const recruitingFilter =
		recruiting === "true" ? true : recruiting === "false" ? false : undefined;

	const teams = await db.query.teamTable.findMany({
		where: and(
			eq(teamTable.isArchived, false),
			recruitingFilter !== undefined ? eq(teamTable.isRecruiting, recruitingFilter) : undefined
		),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			teamSr: true,
			isRecruiting: true,
		},
		with: {
			roster: {
				where: eq(teamRosterTable.status, "active"),
				columns: { id: true },
			},
		},
		orderBy: [asc(teamTable.name)],
		limit: 60,
	});

	return c.json({
		data: teams.map((t) => ({
			id: t.id,
			organizationId: t.organizationId,
			name: t.name,
			tag: t.tag,
			description: t.description ?? null,
			avatarUrl: t.avatarUrl,
			teamSr: t.teamSr,
			isRecruiting: t.isRecruiting,
			activeRosterCount: t.roster.length,
		})),
	});
});

// POST / — Create team
teamRoutes.post("/", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateTeamSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager)
		return c.json(
			{ error: "You do not have permission to create teams in this organisation." },
			403
		);

	const [team] = await db
		.insert(teamTable)
		.values({
			organizationId: orgId,
			name,
			tag: tag.toUpperCase(),
			description: description || null,
		})
		.returning({ id: teamTable.id });

	return c.json({ success: true, teamId: team.id });
});

// PATCH /:id — Update team
teamRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to edit this team." }, 403);

	await db
		.update(teamTable)
		.set({ name, tag: tag.toUpperCase(), description: description || null })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// PATCH /:id/recruiting — Toggle recruiting
teamRoutes.patch("/:id/recruiting", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ToggleRecruitingSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;
	const belongsToOrg = await verifyTeamBelongsToOrg(teamId, orgId);
	if (!belongsToOrg) return c.json({ error: "Team does not belong to this organisation." }, 404);

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to manage this team." }, 403);

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { isRecruiting: true },
	});
	if (!team) return c.json({ error: "Team not found." }, 404);

	await db
		.update(teamTable)
		.set({ isRecruiting: !team.isRecruiting })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// POST /:id/archive — Archive team
teamRoutes.post("/:id/archive", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ArchiveTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;
	const belongsToOrg = await verifyTeamBelongsToOrg(teamId, orgId);
	if (!belongsToOrg) return c.json({ error: "Team does not belong to this organisation." }, 404);

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to archive this team." }, 403);

	await db
		.update(teamTable)
		.set({ isArchived: true, isRecruiting: false })
		.where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// POST /:id/unarchive — Restore archived team
teamRoutes.post("/:id/unarchive", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(ArchiveTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;
	const belongsToOrg = await verifyTeamBelongsToOrg(teamId, orgId);
	if (!belongsToOrg) return c.json({ error: "Team does not belong to this organisation." }, 404);

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return c.json({ error: "You do not have permission to restore this team." }, 403);

	await db.update(teamTable).set({ isArchived: false }).where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// DELETE /:id — Delete team (owner only)
teamRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DeleteTeamSchema, { ...body, teamId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { orgId } = parsed.output;
	const belongsToOrg = await verifyTeamBelongsToOrg(teamId, orgId);
	if (!belongsToOrg) return c.json({ error: "Team does not belong to this organisation." }, 404);

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner")
		return c.json({ error: "Only the organisation owner can delete teams." }, 403);

	await db.delete(teamTable).where(eq(teamTable.id, teamId));

	return c.json({ success: true });
});

// GET /:id — Get team with full roster
teamRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			teamSr: true,
			matchesPlayed: true,
			isRecruiting: true,
		},
	});

	if (!team) return c.json({ error: "Team not found." }, 404);

	// Verify user is a member of the owning org
	const orgMember = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, team.organizationId),
			eq(organizationMemberTable.userId, user.id)
		),
		columns: { id: true },
	});
	if (!orgMember) return c.json({ error: "Not a member of this organisation." }, 403);

	const rosterRows = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.teamId, teamId),
		with: {
			user: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: {
							primaryRole: true,
							rank: true,
							rankDivision: true,
						},
					},
				},
			},
		},
		orderBy: [asc(teamRosterTable.joinedAt)],
	});

	return c.json({
		data: {
			id: team.id,
			organizationId: team.organizationId,
			name: team.name,
			tag: team.tag,
			description: team.description ?? null,
			avatarUrl: team.avatarUrl,
			teamSr: team.teamSr,
			matchesPlayed: team.matchesPlayed,
			isRecruiting: team.isRecruiting,
			roster: rosterRows.map((row) => ({
				id: row.id,
				userId: row.user.id,
				displayName: row.user.displayName,
				avatarUrl: row.user.avatarUrl,
				primaryRole: row.user.profile?.primaryRole ?? "damage",
				rank: row.user.profile?.rank ?? null,
				rankDivision: row.user.profile?.rankDivision ?? null,
				roleInTeam: row.roleInTeam,
				status: row.status,
				joinedAt: row.joinedAt,
				leftAt: row.leftAt,
				statusChangedAt: row.updatedAt,
			})),
		},
	});
});

// GET /:id/applications — Pending LFG applications for the team
teamRoutes.get("/:id/applications", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
	});
	if (!team) return c.json({ error: "Team not found." }, 404);

	const isManager = await verifyOrgManager(team.organizationId, user.id);
	if (!isManager) return c.json({ data: [] });

	const posts = await db.query.lfgPostTable.findMany({
		where: and(eq(lfgPostTable.teamId, teamId), eq(lfgPostTable.status, "open")),
		columns: { id: true },
	});

	if (posts.length === 0) return c.json({ data: [] });

	const postIds = posts.map((p) => p.id);

	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.status, "pending"),
		with: {
			post: { columns: { id: true } },
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: { primaryRole: true, rank: true },
					},
				},
			},
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
	});

	return c.json({
		data: rows
			.filter((r) => postIds.includes(r.postId))
			.map((r) => ({
				id: r.id,
				postId: r.postId,
				status: r.status,
				message: r.message ?? null,
				createdAt: r.createdAt,
				applicantUserId: r.applicant.id,
				applicantDisplayName: r.applicant.displayName,
				applicantAvatarUrl: r.applicant.avatarUrl,
				applicantPrimaryRole: r.applicant.profile?.primaryRole ?? null,
				applicantRank: r.applicant.profile?.rank ?? null,
			})),
	});
});

// GET /:id/lfg — LFG posts for the team
teamRoutes.get("/:id/lfg", async (c) => {
	const teamId = c.req.param("id");

	const posts = await db.query.lfgPostTable.findMany({
		where: eq(lfgPostTable.teamId, teamId),
		orderBy: [desc(lfgPostTable.createdAt)],
	});

	return c.json({ data: posts });
});

// DELETE /:id/leave — Current user leaves team roster
teamRoutes.delete("/:id/leave", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("id");

	const roster = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, user.id)),
		columns: { id: true, status: true },
	});
	if (!roster) return c.json({ error: "You are not on this roster." }, 404);
	if (roster.status === "inactive")
		return c.json({ error: "You are no longer active on this roster." }, 400);

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, roster.id));

	return c.json({ success: true });
});

// Mount roster and invite routes under /:id/
teamRoutes.route("/:id/roster", rosterRoutes);
teamRoutes.route("/:id/invites", createTeamIdInviteRoutes());

export { teamRoutes };
