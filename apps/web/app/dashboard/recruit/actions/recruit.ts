"use server";

import {
	type CreateRecruitmentPostInput,
	CreateRecruitmentPostSchema,
	type RecruitmentOwnerType,
	type UpdateRecruitmentPostInput,
	UpdateRecruitmentPostSchema,
} from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string): string | undefined {
	const value = getString(formData, key);
	return value.length > 0 ? value : undefined;
}

function getOptionalNumber(formData: FormData, key: string): number | undefined {
	const value = getOptionalString(formData, key);
	if (!value) return undefined;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}

function getGameRoles(formData: FormData) {
	return formData
		.getAll("gameRoles")
		.map((value) => String(value))
		.filter(
			(value): value is "tank" | "damage" | "support" =>
				value === "tank" || value === "damage" || value === "support"
		);
}

function pushFieldError(
	fieldErrors: Partial<Record<string, string[]>>,
	field: string,
	message: string
) {
	fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function mergeFieldErrors(
	target: Partial<Record<string, string[]>>,
	source: Partial<Record<string, string[]>>
) {
	for (const [field, messages] of Object.entries(source)) {
		if (!messages?.length) continue;
		target[field] = [...(target[field] ?? []), ...messages];
	}
}

function collectFieldErrors(
	issues: Array<{
		message: string;
		path?: Array<{ key?: unknown }>;
	}>
) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	for (const issue of issues) {
		const path = issue.path ?? [];
		const field =
			path.findLast((entry) => typeof entry.key === "string")?.key ??
			path.find((entry) => typeof entry.key === "string")?.key ??
			"form";

		pushFieldError(fieldErrors, typeof field === "string" ? field : "form", issue.message);
	}

	return fieldErrors;
}

function validateRecruitmentPostRules(input: {
	category: "lft" | "lfp" | "lfr" | "lfs";
	ownerType: RecruitmentOwnerType;
	memberType: "player" | "staff";
	teamId?: string;
	organizationId?: string;
}) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	if (input.ownerType === "team" && !input.teamId) {
		pushFieldError(fieldErrors, "teamId", "Select a team to publish this post.");
	}

	if (input.ownerType === "organization" && !input.organizationId) {
		pushFieldError(fieldErrors, "organizationId", "Select an organisation to publish this post.");
	}

	if (input.category === "lft" && input.ownerType !== "player") {
		pushFieldError(fieldErrors, "category", "LFT posts must be created by an individual player.");
	}

	if ((input.category === "lfp" || input.category === "lfr") && input.ownerType !== "team") {
		pushFieldError(
			fieldErrors,
			"category",
			"LFP and LFR posts must be created on behalf of a team."
		);
	}

	if (input.category === "lfs" && input.memberType !== "staff") {
		pushFieldError(fieldErrors, "memberType", "LFS posts must target staff roles.");
	}

	if ((input.category === "lfp" || input.category === "lfr") && input.memberType !== "player") {
		pushFieldError(fieldErrors, "memberType", "LFP and LFR posts must target players.");
	}

	return fieldErrors;
}

function validateRecruitmentNumericFields(input: { minSrRaw: string; maxSrRaw: string }) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	if (input.minSrRaw && !Number.isFinite(Number(input.minSrRaw))) {
		pushFieldError(fieldErrors, "minSr", "Minimum SR must be a number.");
	}

	if (input.maxSrRaw && !Number.isFinite(Number(input.maxSrRaw))) {
		pushFieldError(fieldErrors, "maxSr", "Maximum SR must be a number.");
	}

	return fieldErrors;
}

function validateCreateRecruitmentPostInput(input: CreateRecruitmentPostInput) {
	const fieldErrors = validateRecruitmentPostRules(input);
	const parsed = v.safeParse(CreateRecruitmentPostSchema, input);

	if (!parsed.success) {
		mergeFieldErrors(fieldErrors, collectFieldErrors(parsed.issues));
	}

	return fieldErrors;
}

function validateUpdateRecruitmentPostInput(
	input: UpdateRecruitmentPostInput,
	ownerType: RecruitmentOwnerType
) {
	const fieldErrors = validateRecruitmentPostRules({
		category: input.category as "lft" | "lfp" | "lfr" | "lfs",
		ownerType,
		memberType: input.memberType as "player" | "staff",
	});
	const parsed = v.safeParse(UpdateRecruitmentPostSchema, input);

	if (!parsed.success) {
		mergeFieldErrors(fieldErrors, collectFieldErrors(parsed.issues));
	}

	return fieldErrors;
}

function hasFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
	return Object.keys(fieldErrors).length > 0;
}

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

async function getOrgSlug(orgId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const org = await getOrgWithTeams(orgId, user.id);
	return org?.slug ?? null;
}

async function revalidateRecruitPaths(input: {
	teamId?: string;
	orgId?: string;
	playerUsername?: string;
}) {
	revalidatePath(dashboardRoutes.discover.posts);
	revalidatePath(dashboardRoutes.discover.conversations);
	revalidatePath("/posts");
	revalidatePath("/players");

	if (input.playerUsername) revalidatePath(`/players/${input.playerUsername}`);

	if (input.teamId) {
		revalidatePath(`/teams/${input.teamId}`);
		const orgId = input.orgId ?? (await getVerifiedTeamOrgId(input.teamId));
		if (orgId) {
			revalidatePath(dashboardRoutes.context.teamById(orgId, input.teamId));
			revalidatePath(dashboardRoutes.context.teamPosts(orgId, input.teamId));
			revalidatePath(dashboardRoutes.context.teamConversations(orgId, input.teamId));
			revalidatePath(dashboardRoutes.context.orgById(orgId));
			revalidatePath(dashboardRoutes.context.orgPosts(orgId));
			revalidatePath(dashboardRoutes.context.orgConversations(orgId));
			const slug = await getOrgSlug(orgId);
			if (slug) revalidatePath(`/orgs/${slug}`);
		}
		return;
	}

	if (input.orgId) {
		revalidatePath(dashboardRoutes.context.orgById(input.orgId));
		revalidatePath(dashboardRoutes.context.orgPosts(input.orgId));
		revalidatePath(dashboardRoutes.context.orgConversations(input.orgId));
		const slug = await getOrgSlug(input.orgId);
		if (slug) revalidatePath(`/orgs/${slug}`);
	}
}

export async function createRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const sdk = getServerSdk();
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const ownerType =
		(getOptionalString(formData, "ownerType") as "player" | "team" | "organization" | undefined) ??
		"player";
	const memberType =
		(getOptionalString(formData, "memberType") as "player" | "staff" | undefined) ?? "player";
	const teamId = getOptionalString(formData, "teamId");
	const organizationId = getOptionalString(formData, "organizationId");
	const minSrRaw = getString(formData, "minSr");
	const maxSrRaw = getString(formData, "maxSr");
	const input: CreateRecruitmentPostInput = {
		category: getString(formData, "category") as "lft" | "lfp" | "lfr" | "lfs",
		ownerType,
		title: getString(formData, "title"),
		description: getOptionalString(formData, "description"),
		memberType,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
		gameRoles: getGameRoles(formData),
		minRank: getOptionalString(formData, "minRank"),
		maxRank: getOptionalString(formData, "maxRank"),
		minSr: getOptionalNumber(formData, "minSr"),
		maxSr: getOptionalNumber(formData, "maxSr"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
		teamId,
		organizationId,
	};
	const fieldErrors = validateCreateRecruitmentPostInput(input);
	mergeFieldErrors(fieldErrors, validateRecruitmentNumericFields({ minSrRaw, maxSrRaw }));
	if (hasFieldErrors(fieldErrors)) return { fieldErrors };

	const result = await sdk.recruit.createPost(input);

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId,
		orgId: organizationId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true, postId: actionResult.data.postId };
}

export async function updateRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const postId = getString(formData, "postId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");
	const minSrRaw = getString(formData, "minSr");
	const maxSrRaw = getString(formData, "maxSr");
	const ownerType =
		(getOptionalString(formData, "ownerType") as RecruitmentOwnerType | undefined) ?? "player";
	const input: UpdateRecruitmentPostInput = {
		postId,
		category: getOptionalString(formData, "category") as "lft" | "lfp" | "lfr" | "lfs" | undefined,
		status: getOptionalString(formData, "status") as
			| "open"
			| "closed"
			| "fulfilled"
			| "expired"
			| undefined,
		title: getOptionalString(formData, "title"),
		description: getOptionalString(formData, "description"),
		memberType: getOptionalString(formData, "memberType") as "player" | "staff" | undefined,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
		gameRoles: getGameRoles(formData),
		minRank: getOptionalString(formData, "minRank"),
		maxRank: getOptionalString(formData, "maxRank"),
		minSr: getOptionalNumber(formData, "minSr"),
		maxSr: getOptionalNumber(formData, "maxSr"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
	};
	const fieldErrors = validateUpdateRecruitmentPostInput(input, ownerType);
	mergeFieldErrors(fieldErrors, validateRecruitmentNumericFields({ minSrRaw, maxSrRaw }));
	if (hasFieldErrors(fieldErrors)) return { fieldErrors };

	const result = await sdk.recruit.updatePost(input);

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({ teamId, orgId });
	return { success: true };
}

export async function deleteRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const postId = getString(formData, "postId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");
	const ownerType = getOptionalString(formData, "ownerType");

	const result = await sdk.recruit.deletePost({ postId });
	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId,
		orgId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true };
}

export async function respondToRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { threadId?: string; responseId?: string }> {
	const sdk = getServerSdk();
	const postId = getString(formData, "postId");
	const result = await sdk.recruit.respondToPost({
		postId,
		message: getOptionalString(formData, "message"),
		senderTeamId: getOptionalString(formData, "senderTeamId"),
		senderOrganizationId: getOptionalString(formData, "senderOrganizationId"),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return {
		success: true,
		threadId: actionResult.data.threadId,
		responseId: actionResult.data.responseId,
	};
}

export async function withdrawRecruitmentResponseAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const responseId = getString(formData, "responseId");
	const result = await sdk.recruit.withdrawResponse({ responseId });
	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}

export async function decideRecruitmentResponseAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const responseId = getString(formData, "responseId");
	const result = await sdk.recruit.decideResponse({
		responseId,
		action: getString(formData, "action") as "accept" | "reject",
		gameRole: getOptionalString(formData, "gameRole") as "tank" | "damage" | "support" | undefined,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}

export async function sendRecruitmentMessageAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.recruit.sendMessage({
		threadId: getString(formData, "threadId"),
		content: getString(formData, "content"),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}
