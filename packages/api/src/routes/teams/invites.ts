import { InviteToTeamSchema, RespondToTeamInviteSchema } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { organizationMemberTable, teamInviteTable, teamRosterTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { verifyOrgManager } from "@/utils/org";

const teamInviteRoutes = new Hono<AuthEnv>();

// POST /:id/respond — Accept/decline team invite
// NOTE: Mounted at /teams/invites/:id/respond
teamInviteRoutes.post("/:id/respond", async (c) => {
	const user = c.get("user");
	const inviteId = c.req.param("id");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(RespondToTeamInviteSchema, { ...body, inviteId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { action } = parsed.output;

	const invite = await db.query.teamInviteTable.findFirst({
		where: eq(teamInviteTable.id, inviteId),
		with: {
			team: { columns: { id: true, name: true, organizationId: true } },
		},
		columns: {
			id: true,
			inviteeUserId: true,
			teamId: true,
			roleInTeam: true,
			status: true,
			expiresAt: true,
		},
	});
	if (!invite) return c.json({ error: "Invite not found." }, 404);
	if (invite.inviteeUserId !== user.id)
		return c.json({ error: "This invite is not for you." }, 403);
	if (invite.status !== "pending")
		return c.json({ error: "This invite is no longer active." }, 400);
	if (invite.expiresAt < new Date()) return c.json({ error: "This invite has expired." }, 400);

	if (action === "accept") {
		await db.transaction(async (tx) => {
			// Upsert roster entry
			const existing = await tx.query.teamRosterTable.findFirst({
				where: and(eq(teamRosterTable.teamId, invite.teamId), eq(teamRosterTable.userId, user.id)),
				columns: { id: true },
			});

			if (existing) {
				await tx
					.update(teamRosterTable)
					.set({
						status: "trial",
						roleInTeam: invite.roleInTeam,
						leftAt: null,
						joinedAt: new Date(),
					})
					.where(eq(teamRosterTable.id, existing.id));
			} else {
				await tx.insert(teamRosterTable).values({
					teamId: invite.teamId,
					userId: user.id,
					roleInTeam: invite.roleInTeam,
					status: "trial",
					joinedAt: new Date(),
				});
			}

			// Ensure user is an org member
			const orgMember = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, invite.team.organizationId),
					eq(organizationMemberTable.userId, user.id)
				),
				columns: { id: true },
			});
			if (!orgMember) {
				await tx.insert(organizationMemberTable).values({
					organizationId: invite.team.organizationId,
					userId: user.id,
					role: "player",
				});
			}

			await tx
				.update(teamInviteTable)
				.set({ status: "accepted" })
				.where(eq(teamInviteTable.id, inviteId));
		});

		// Notify team managers
		const managers = await db.query.organizationMemberTable.findMany({
			where: and(
				eq(organizationMemberTable.organizationId, invite.team.organizationId),
				eq(organizationMemberTable.role, "manager")
			),
			columns: { userId: true },
		});
		for (const m of managers) {
			await createNotification({
				userId: m.userId,
				type: "team_invite_accepted",
				title: `A player accepted your invite to ${invite.team.name}`,
				referenceType: "team",
				referenceId: invite.teamId,
			});
		}
	} else {
		await db
			.update(teamInviteTable)
			.set({ status: "declined" })
			.where(eq(teamInviteTable.id, inviteId));
	}

	return c.json({ success: true });
});

export { teamInviteRoutes };

// ─── Routes mounted under /teams/:id/invites ─────────────────────────────────
// These are added to the team router separately since they need the team :id param

export function createTeamIdInviteRoutes() {
	const routes = new Hono<AuthEnv>();

	// POST / — Send team invite
	routes.post("/", async (c) => {
		const user = c.get("user");

		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(InviteToTeamSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		const { orgId, teamId, userId, roleInTeam } = parsed.output;

		const isManager = await verifyOrgManager(orgId, user.id);
		if (!isManager) return c.json({ error: "You do not have permission to invite players." }, 403);

		// Check not already active
		const onRoster = await db.query.teamRosterTable.findFirst({
			where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
			columns: { status: true },
		});
		if (onRoster && onRoster.status !== "inactive")
			return c.json({ error: "This player is already on the roster." }, 409);

		// Check no pending invite
		const existingInvite = await db.query.teamInviteTable.findFirst({
			where: and(
				eq(teamInviteTable.teamId, teamId),
				eq(teamInviteTable.inviteeUserId, userId),
				eq(teamInviteTable.status, "pending")
			),
			columns: { id: true, expiresAt: true },
		});
		if (existingInvite && existingInvite.expiresAt > new Date())
			return c.json({ error: "An invite is already pending for this player." }, 409);

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
			columns: { name: true },
		});

		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		await db.insert(teamInviteTable).values({
			teamId,
			inviteeUserId: userId,
			inviterUserId: user.id,
			roleInTeam,
			expiresAt,
		});

		await createNotification({
			userId,
			type: "team_invite_received",
			title: `You've been invited to join ${team?.name ?? "a team"}`,
			body: `You were invited as ${roleInTeam}.`,
			referenceType: "team_invite",
		});

		return c.json({ success: true });
	});

	// DELETE /:inviteId — Cancel team invite
	routes.delete("/:inviteId", async (c) => {
		const user = c.get("user");
		const inviteId = c.req.param("inviteId");

		const invite = await db.query.teamInviteTable.findFirst({
			where: eq(teamInviteTable.id, inviteId),
			with: { team: { columns: { organizationId: true } } },
			columns: { id: true, status: true, teamId: true },
		});
		if (!invite) return c.json({ error: "Invite not found." }, 404);
		if (invite.status !== "pending")
			return c.json({ error: "This invite is no longer active." }, 400);

		const isManager = await verifyOrgManager(invite.team.organizationId, user.id);
		if (!isManager)
			return c.json({ error: "You do not have permission to cancel this invite." }, 403);

		await db
			.update(teamInviteTable)
			.set({ status: "cancelled" })
			.where(eq(teamInviteTable.id, inviteId));

		return c.json({ success: true });
	});

	return routes;
}
