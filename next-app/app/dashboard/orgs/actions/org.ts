"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as v from "valibot";

import { db } from "@/db";
import {
	organizationMemberTable,
	organizationTable,
	orgInviteTable,
	teamRosterTable,
} from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserOrgRole, verifyOrgManager } from "@/lib/data/organization";
import { createNotification } from "@/lib/notifications";
import {
	CreateOrgSchema,
	DeleteOrgSchema,
	InviteToOrgSchema,
	RemoveOrgMemberSchema,
	RespondToOrgInviteSchema,
	UpdateOrgMemberRoleSchema,
	UpdateOrgSchema,
} from "@/lib/validations/org";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function nameToSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "org"
	);
}

async function ensureUniqueSlug(base: string): Promise<string> {
	const existing = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.slug, base),
		columns: { id: true },
	});
	if (!existing) return base;

	// Append a random 4-char suffix and try once more.
	const suffix = Math.random().toString(36).substring(2, 6);
	const candidate = `${base}-${suffix}`;
	const conflict = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.slug, candidate),
		columns: { id: true },
	});
	return conflict ? `${candidate}-${Math.random().toString(36).substring(2, 6)}` : candidate;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { orgId?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(CreateOrgSchema, {
		name: formData.get("name"),
		description: formData.get("description") || undefined,
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { name, description } = parsed.output;
	const slug = await ensureUniqueSlug(nameToSlug(name));

	const [org] = await db
		.insert(organizationTable)
		.values({ name, slug, description: description || null, ownerId: user.id })
		.returning({ id: organizationTable.id });

	await db.insert(organizationMemberTable).values({
		organizationId: org.id,
		userId: user.id,
		role: "owner",
	});

	revalidatePath("/dashboard/orgs");
	return { success: true, orgId: org.id };
}

export async function updateOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(UpdateOrgSchema, {
		orgId: formData.get("orgId"),
		name: formData.get("name"),
		description: formData.get("description") || undefined,
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { orgId, name, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to edit this organisation." };

	await db
		.update(organizationTable)
		.set({ name, description: description || null })
		.where(eq(organizationTable.id, orgId));

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function deleteOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(DeleteOrgSchema, {
		orgId: formData.get("orgId"),
		confirmName: formData.get("confirmName"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, confirmName } = parsed.output;

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return { error: "Only the organisation owner can delete it." };

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { name: true },
	});
	if (!org) return { error: "Organisation not found." };
	if (org.name !== confirmName) return { error: "Organisation name does not match." };

	await db.delete(organizationTable).where(eq(organizationTable.id, orgId));

	revalidatePath("/dashboard/orgs");
	redirect("/dashboard/orgs");
}

export async function updateOrgMemberRoleAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(UpdateOrgMemberRoleSchema, {
		orgId: formData.get("orgId"),
		memberId: formData.get("memberId"),
		role: formData.get("role"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, memberId, role } = parsed.output;

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (actorRole !== "owner" && actorRole !== "manager")
		return { error: "You do not have permission to manage members." };

	// Managers cannot promote to owner or manager.
	if (actorRole === "manager" && (role === "owner" || role === "manager"))
		return { error: "Managers can only assign coach, analyst, or player roles." };

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { userId: true, role: true, organizationId: true },
	});
	if (!member || member.organizationId !== orgId) return { error: "Member not found." };
	if (member.role === "owner") return { error: "The owner's role cannot be changed." };

	await db
		.update(organizationMemberTable)
		.set({ role })
		.where(eq(organizationMemberTable.id, memberId));

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function removeOrgMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(RemoveOrgMemberSchema, {
		orgId: formData.get("orgId"),
		memberId: formData.get("memberId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, memberId } = parsed.output;

	const actorRole = await getUserOrgRole(orgId, user.id);
	if (actorRole !== "owner" && actorRole !== "manager")
		return { error: "You do not have permission to remove members." };

	const member = await db.query.organizationMemberTable.findFirst({
		where: eq(organizationMemberTable.id, memberId),
		columns: { userId: true, role: true, organizationId: true },
	});
	if (!member || member.organizationId !== orgId) return { error: "Member not found." };
	if (member.role === "owner") return { error: "The owner cannot be removed." };

	// Mark all their team roster entries in this org as inactive.
	const orgTeams = await db.query.teamRosterTable.findMany({
		where: eq(teamRosterTable.userId, member.userId),
		with: { team: { columns: { organizationId: true } } },
		columns: { id: true },
	});
	const teamIds = orgTeams.filter((r) => r.team.organizationId === orgId).map((r) => r.id);

	await db.transaction(async (tx) => {
		for (const rosterId of teamIds) {
			await tx
				.update(teamRosterTable)
				.set({ status: "inactive", leftAt: new Date() })
				.where(eq(teamRosterTable.id, rosterId));
		}
		await tx.delete(organizationMemberTable).where(eq(organizationMemberTable.id, memberId));
	});

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function inviteToOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(InviteToOrgSchema, {
		orgId: formData.get("orgId"),
		userId: formData.get("userId"),
		role: formData.get("role"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, userId, role } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to invite members." };

	// Check not already a member.
	const existing = await db.query.organizationMemberTable.findFirst({
		where: and(
			eq(organizationMemberTable.organizationId, orgId),
			eq(organizationMemberTable.userId, userId)
		),
		columns: { id: true },
	});
	if (existing) return { error: "This user is already a member of the organisation." };

	// Upsert invite — if a prior non-pending invite exists for same (org, user), replace it.
	const existingInvite = await db.query.orgInviteTable.findFirst({
		where: and(eq(orgInviteTable.organizationId, orgId), eq(orgInviteTable.inviteeUserId, userId)),
		columns: { id: true, status: true },
	});
	if (existingInvite?.status === "pending")
		return { error: "An invite is already pending for this user." };

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, orgId),
		columns: { name: true },
	});

	await db.insert(orgInviteTable).values({
		organizationId: orgId,
		inviteeUserId: userId,
		inviterUserId: user.id,
		role,
		expiresAt,
	});

	await createNotification({
		userId,
		type: "org_invite_received",
		title: `You've been invited to join ${org?.name ?? "an organisation"}`,
		body: `You were invited as ${role}.`,
		referenceType: "org_invite",
	});

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function respondToOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(RespondToOrgInviteSchema, {
		inviteId: formData.get("inviteId"),
		action: formData.get("action"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { inviteId, action } = parsed.output;

	const invite = await db.query.orgInviteTable.findFirst({
		where: eq(orgInviteTable.id, inviteId),
		columns: {
			id: true,
			inviteeUserId: true,
			organizationId: true,
			role: true,
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
			// Upsert membership — user may have been re-invited after removal.
			const alreadyMember = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, invite.organizationId),
					eq(organizationMemberTable.userId, user.id)
				),
				columns: { id: true },
			});
			if (!alreadyMember) {
				await tx.insert(organizationMemberTable).values({
					organizationId: invite.organizationId,
					userId: user.id,
					role: invite.role,
				});
			}
			await tx
				.update(orgInviteTable)
				.set({ status: "accepted" })
				.where(eq(orgInviteTable.id, inviteId));
		});
	} else {
		await db
			.update(orgInviteTable)
			.set({ status: "declined" })
			.where(eq(orgInviteTable.id, inviteId));
	}

	revalidatePath("/dashboard/invitations");
	revalidatePath(`/dashboard/orgs/${invite.organizationId}`);
	return { success: true };
}
