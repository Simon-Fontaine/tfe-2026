import { AvailabilitySchema } from "@scrimflow/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { availabilityTable, playerProfileTable, teamRosterTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { getLifecycleMutationBlockReason } from "@/utils/lifecycle";
import { getTeamAccessContext, verifyUserOnTeam } from "@/utils/team";

const scheduleRoutes = new Hono<AuthEnv>();

// GET /availability — Get user's availability for a team
scheduleRoutes.get("/availability", async (c) => {
	const user = c.get("user");
	const teamId = c.req.query("teamId");

	if (!teamId) return c.json({ error: "teamId query parameter is required." }, 400);

	const rows = await db.query.availabilityTable.findMany({
		where: and(eq(availabilityTable.userId, user.id), eq(availabilityTable.teamId, teamId)),
		columns: {
			id: true,
			userId: true,
			teamId: true,
			dayOfWeek: true,
			specificDate: true,
			startTime: true,
			endTime: true,
			timezone: true,
			label: true,
		},
		orderBy: [asc(availabilityTable.dayOfWeek), asc(availabilityTable.specificDate)],
	});

	return c.json({ data: rows });
});

// GET /teams — Get user's active teams (for team selector)
scheduleRoutes.get("/teams", async (c) => {
	const user = c.get("user");

	const rows = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.userId, user.id), eq(teamRosterTable.status, "active")),
		with: {
			team: {
				columns: { id: true, name: true, tag: true },
			},
		},
	});

	return c.json({ data: rows.map((r) => r.team) });
});

// GET /team/:teamId — Team-wide schedule for active members
scheduleRoutes.get("/team/:teamId", async (c) => {
	const user = c.get("user");
	const teamId = c.req.param("teamId");

	const access = await getTeamAccessContext(teamId, user.id);
	if (!access) return c.json({ error: "Team not found." }, 404);
	if (!access.canManageTeam && access.teamStatus !== "active") {
		return c.json({ error: "You do not have access to this team's schedule." }, 403);
	}

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { id: true, name: true, tag: true, lifecycleStatus: true },
	});
	if (!team) return c.json({ error: "Team not found." }, 404);

	const members = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.status, "active")),
		columns: {
			userId: true,
			memberType: true,
			permissionRole: true,
			status: true,
			roleInTeam: true,
			staffRole: true,
		},
		with: {
			user: {
				columns: {
					displayName: true,
					avatarUrl: true,
				},
			},
		},
		orderBy: [asc(teamRosterTable.memberType), asc(teamRosterTable.joinedAt)],
	});

	const memberUserIds = members.map((m) => m.userId);

	const profiles = memberUserIds.length
		? await db.query.playerProfileTable.findMany({
				where: inArray(playerProfileTable.userId, memberUserIds),
				columns: { userId: true, availabilityVisibility: true },
			})
		: [];
	const visibilityMap = new Map(profiles.map((p) => [p.userId, p.availabilityVisibility]));

	const privateUserIds = new Set(
		memberUserIds.filter((id) => id !== user.id && visibilityMap.get(id) === "private")
	);

	const allAvailability = memberUserIds.length
		? await db.query.availabilityTable.findMany({
				where: and(
					eq(availabilityTable.teamId, teamId),
					inArray(availabilityTable.userId, memberUserIds)
				),
				columns: {
					id: true,
					userId: true,
					teamId: true,
					dayOfWeek: true,
					specificDate: true,
					startTime: true,
					endTime: true,
					timezone: true,
					label: true,
				},
				orderBy: [asc(availabilityTable.dayOfWeek), asc(availabilityTable.specificDate)],
			})
		: [];

	const availability = allAvailability.filter((row) => !privateUserIds.has(row.userId));

	return c.json({
		data: {
			teamId: team.id,
			teamName: team.name,
			teamTag: team.tag,
			members: members.map((member) => ({
				userId: member.userId,
				displayName: member.user.displayName,
				avatarUrl: member.user.avatarUrl,
				memberType: member.memberType,
				permissionRole: member.permissionRole,
				status: member.status,
				gameRole: member.roleInTeam,
				staffRole: member.staffRole,
				availabilityHidden:
					member.userId !== user.id && visibilityMap.get(member.userId) === "private",
			})),
			availability,
		},
	});
});

// POST /availability — Add availability
scheduleRoutes.post("/availability", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(AvailabilitySchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { teamId, type, dayOfWeek, specificDate, startTime, endTime, timezone, label } =
		parsed.output;

	const onTeam = await verifyUserOnTeam(user.id, teamId);
	if (!onTeam) return c.json({ error: "You are not an active member of this team." }, 403);
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { lifecycleStatus: true },
	});
	const lifecycleBlock = getLifecycleMutationBlockReason("Team", team?.lifecycleStatus);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	await db.insert(availabilityTable).values({
		userId: user.id,
		teamId,
		dayOfWeek: type === "recurring" ? (dayOfWeek ?? null) : null,
		specificDate: type === "one_off" && specificDate ? new Date(specificDate) : null,
		startTime,
		endTime,
		timezone,
		label: label || null,
	});

	return c.json({ success: true });
});

// DELETE /availability/:id — Delete availability
scheduleRoutes.delete("/availability/:id", async (c) => {
	const user = c.get("user");
	const id = c.req.param("id");

	const row = await db.query.availabilityTable.findFirst({
		where: eq(availabilityTable.id, id),
		columns: { userId: true, teamId: true },
	});
	if (!row) return c.json({ error: "Availability window not found." }, 404);
	if (row.userId !== user.id) return c.json({ error: "Not authorized." }, 403);

	// D7-P: deleting availability is a housekeeping action — exempt from lifecycle block
	// so members can clean up their schedule even when the team is archived or deletion-pending.
	await db.delete(availabilityTable).where(eq(availabilityTable.id, id));

	return c.json({ success: true });
});

export { scheduleRoutes };
