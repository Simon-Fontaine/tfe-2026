"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import {
	lfgApplicationTable,
	lfgPostTable,
	organizationMemberTable,
	teamRosterTable,
} from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { isUserOnTeam } from "@/lib/data/lfg";
import { verifyOrgManager } from "@/lib/data/organization";
import { createNotification } from "@/lib/notifications";
import {
	ApplyToLfgPostSchema,
	CloseLfgPostSchema,
	CreateLfgPostSchema,
	RespondToApplicationSchema,
	WithdrawApplicationSchema,
} from "@/lib/validations/lfg";

export async function createLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const rolesNeeded = formData.getAll("rolesNeeded") as string[];

	const parsed = v.safeParse(CreateLfgPostSchema, {
		teamId: formData.get("teamId"),
		orgId: formData.get("orgId"),
		rolesNeeded,
		minRank: formData.get("minRank") || undefined,
		maxRank: formData.get("maxRank") || undefined,
		description: formData.get("description") || undefined,
		region: formData.get("region") || undefined,
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const {
		teamId,
		orgId,
		rolesNeeded: roles,
		minRank,
		maxRank,
		description,
		region,
	} = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to post on behalf of this team." };

	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const [post] = await db
		.insert(lfgPostTable)
		.values({
			type: "team_seeking_player",
			userId: user.id,
			teamId,
			rolesNeeded: roles,
			minRank: minRank ?? null,
			maxRank: maxRank ?? null,
			description: description ?? null,
			region: region ?? null,
			expiresAt,
		})
		.returning({ id: lfgPostTable.id });

	revalidatePath("/dashboard/scrims");
	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true, postId: post.id };
}

export async function closeLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(CloseLfgPostSchema, {
		postId: formData.get("postId"),
		orgId: formData.get("orgId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { postId, orgId } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to close this post." };

	await db.update(lfgPostTable).set({ status: "closed" }).where(eq(lfgPostTable.id, postId));

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function applyToLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(ApplyToLfgPostSchema, {
		postId: formData.get("postId"),
		message: formData.get("message") || undefined,
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { postId, message } = parsed.output;

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: { id: true, status: true, teamId: true, userId: true },
	});
	if (!post) return { error: "Post not found." };
	if (post.status !== "open") return { error: "This post is no longer accepting applications." };

	// Prevent applying to your own team's post.
	if (post.teamId) {
		const onTeam = await isUserOnTeam(user.id, post.teamId);
		if (onTeam) return { error: "You are already a member of this team." };
	}

	const existing = await db.query.lfgApplicationTable.findFirst({
		where: and(
			eq(lfgApplicationTable.postId, postId),
			eq(lfgApplicationTable.applicantUserId, user.id)
		),
		columns: { id: true, status: true },
	});
	if (existing && existing.status === "pending")
		return { error: "You have already applied to this post." };

	await db.insert(lfgApplicationTable).values({
		postId,
		applicantUserId: user.id,
		message: message ?? null,
	});

	// Notify the post owner.
	await createNotification({
		userId: post.userId,
		type: "recruitment_application",
		title: "New application received",
		body: message ?? undefined,
		referenceType: "lfg_post",
		referenceId: postId,
	});

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function withdrawApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(WithdrawApplicationSchema, {
		applicationId: formData.get("applicationId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { applicationId } = parsed.output;

	const app = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, applicationId),
		columns: { id: true, applicantUserId: true, status: true },
	});
	if (!app) return { error: "Application not found." };
	if (app.applicantUserId !== user.id) return { error: "This application is not yours." };
	if (app.status !== "pending") return { error: "This application is no longer active." };

	await db
		.update(lfgApplicationTable)
		.set({ status: "withdrawn" })
		.where(eq(lfgApplicationTable.id, applicationId));

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function respondToApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(RespondToApplicationSchema, {
		applicationId: formData.get("applicationId"),
		orgId: formData.get("orgId"),
		action: formData.get("action"),
		roleInTeam: formData.get("roleInTeam") || undefined,
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { applicationId, orgId, action, roleInTeam } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to respond to applications." };

	const app = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, applicationId),
		with: {
			post: {
				columns: { id: true, teamId: true, status: true },
			},
		},
		columns: { id: true, applicantUserId: true, status: true, postId: true },
	});
	if (!app) return { error: "Application not found." };
	if (app.status !== "pending") return { error: "This application has already been reviewed." };
	if (app.post.status !== "open") return { error: "The associated post is no longer open." };

	if (action === "accept") {
		if (!app.post.teamId) return { error: "No team associated with this post." };
		const postTeamId = app.post.teamId;
		const role = roleInTeam ?? "damage";

		await db.transaction(async (tx) => {
			// Upsert roster entry.
			const existing = await tx.query.teamRosterTable.findFirst({
				where: and(
					eq(teamRosterTable.teamId, postTeamId),
					eq(teamRosterTable.userId, app.applicantUserId)
				),
				columns: { id: true },
			});

			if (existing) {
				await tx
					.update(teamRosterTable)
					.set({
						status: "trial",
						roleInTeam: role as "tank" | "damage" | "support",
						leftAt: null,
						joinedAt: new Date(),
					})
					.where(eq(teamRosterTable.id, existing.id));
			} else {
				await tx.insert(teamRosterTable).values({
					teamId: postTeamId,
					userId: app.applicantUserId,
					roleInTeam: role as "tank" | "damage" | "support",
					status: "trial",
					joinedAt: new Date(),
				});
			}

			// Auto-add to org if not already a member.
			const orgMember = await tx.query.organizationMemberTable.findFirst({
				where: and(
					eq(organizationMemberTable.organizationId, orgId),
					eq(organizationMemberTable.userId, app.applicantUserId)
				),
				columns: { id: true },
			});
			if (!orgMember) {
				await tx.insert(organizationMemberTable).values({
					organizationId: orgId,
					userId: app.applicantUserId,
					role: "player",
				});
			}

			await tx
				.update(lfgApplicationTable)
				.set({ status: "accepted" })
				.where(eq(lfgApplicationTable.id, applicationId));
		});

		await createNotification({
			userId: app.applicantUserId,
			type: "recruitment_accepted",
			title: "Your application was accepted!",
			referenceType: "lfg_application",
			referenceId: applicationId,
		});
	} else {
		await db
			.update(lfgApplicationTable)
			.set({ status: "rejected" })
			.where(eq(lfgApplicationTable.id, applicationId));

		await createNotification({
			userId: app.applicantUserId,
			type: "recruitment_rejected",
			title: "Your application was not accepted.",
			referenceType: "lfg_application",
			referenceId: applicationId,
		});
	}

	revalidatePath("/dashboard/scrims");
	if (app.post.teamId) {
		revalidatePath(`/dashboard/teams/${app.post.teamId}`);
	}
	return { success: true };
}
