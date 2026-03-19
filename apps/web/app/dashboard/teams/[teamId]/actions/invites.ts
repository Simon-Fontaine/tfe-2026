"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import { organizationMemberTable, teamInviteTable, teamRosterTable, teamTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { verifyOrgManager } from "@/lib/data/organization";
import { createNotification } from "@/lib/notifications";
import {
	CancelTeamInviteSchema,
	InviteToTeamSchema,
	RespondToTeamInviteSchema,
} from "@/lib/validations/org";

export async function sendTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(InviteToTeamSchema, {
		orgId: formData.get("orgId"),
		teamId: formData.get("teamId"),
		userId: formData.get("userId"),
		roleInTeam: formData.get("roleInTeam"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, teamId, userId, roleInTeam } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to invite players." };

	// Check the user is not already an active member.
	const onRoster = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { status: true },
	});
	if (onRoster && onRoster.status !== "inactive")
		return { error: "This player is already on the roster." };

	// Check no pending invite already exists.
	const existingInvite = await db.query.teamInviteTable.findFirst({
		where: and(
			eq(teamInviteTable.teamId, teamId),
			eq(teamInviteTable.inviteeUserId, userId),
			eq(teamInviteTable.status, "pending")
		),
		columns: { id: true, expiresAt: true },
	});
	if (existingInvite && existingInvite.expiresAt > new Date())
		return { error: "An invite is already pending for this player." };

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

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function cancelTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(CancelTeamInviteSchema, {
		inviteId: formData.get("inviteId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { inviteId } = parsed.output;

	const invite = await db.query.teamInviteTable.findFirst({
		where: eq(teamInviteTable.id, inviteId),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true, status: true, teamId: true },
	});
	if (!invite) return { error: "Invite not found." };
	if (invite.status !== "pending") return { error: "This invite is no longer active." };

	const isManager = await verifyOrgManager(invite.team.organizationId, user.id);
	if (!isManager) return { error: "You do not have permission to cancel this invite." };

	await db
		.update(teamInviteTable)
		.set({ status: "cancelled" })
		.where(eq(teamInviteTable.id, inviteId));

	revalidatePath(`/dashboard/teams/${invite.teamId}`);
	return { success: true };
}

export async function respondToTeamInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(RespondToTeamInviteSchema, {
		inviteId: formData.get("inviteId"),
		action: formData.get("action"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { inviteId, action } = parsed.output;

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
	if (!invite) return { error: "Invite not found." };
	if (invite.inviteeUserId !== user.id) return { error: "This invite is not for you." };
	if (invite.status !== "pending") return { error: "This invite is no longer active." };
	if (invite.expiresAt < new Date()) return { error: "This invite has expired." };

	if (action === "accept") {
		await db.transaction(async (tx) => {
			// Upsert roster entry.
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

			// Ensure user is an org member (player role).
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

		// Notify team managers.
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

	revalidatePath("/dashboard/invitations");
	revalidatePath(`/dashboard/teams/${invite.teamId}`);
	return { success: true };
}
