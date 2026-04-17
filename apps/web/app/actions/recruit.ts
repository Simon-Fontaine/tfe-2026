"use server";

import {
	type CreateRecruitmentListingInput,
	CreateRecruitmentListingSchema,
	type RecruitmentOwnerType,
	type UpdateRecruitmentListingInput,
	UpdateRecruitmentListingSchema,
} from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getTeamWithRoster } from "@/lib/data/teams";
import { getRecruitmentRank } from "@/lib/recruitment";
import { apiRoutes, appRoutes } from "@/lib/routes";

type ApiActionError = {
	error: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	status: number;
};

type ApiActionSuccess<T extends Record<string, unknown> = Record<string, never>> = {
	success: true;
} & T;

function isApiActionError<T extends Record<string, unknown>>(
	result: ApiActionSuccess<T> | ApiActionError
): result is ApiActionError {
	return "error" in result;
}

function toFormActionError(result: ApiActionError): FormActionResult {
	return {
		error: result.error,
		fieldErrors: result.fieldErrors,
	};
}

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

function validateRecruitmentListingRules(input: {
	category: "lft" | "lfp" | "lfr" | "lfs";
	ownerType: RecruitmentOwnerType;
	memberType: "player" | "staff";
	teamId?: string;
	organizationId?: string;
}) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	if (input.ownerType === "team" && !input.teamId) {
		pushFieldError(fieldErrors, "teamId", "Select a team to publish this listing.");
	}

	if (input.ownerType === "organization" && !input.organizationId) {
		pushFieldError(
			fieldErrors,
			"organizationId",
			"Select an organisation to publish this listing."
		);
	}

	if (input.category === "lft" && input.ownerType !== "player") {
		pushFieldError(
			fieldErrors,
			"category",
			"LFT listings must be created by an individual player."
		);
	}

	if ((input.category === "lfp" || input.category === "lfr") && input.ownerType !== "team") {
		pushFieldError(
			fieldErrors,
			"category",
			"LFP and LFR listings must be created on behalf of a team."
		);
	}

	if (input.category === "lfs" && input.memberType !== "staff") {
		pushFieldError(fieldErrors, "memberType", "LFS listings must target staff roles.");
	}

	if ((input.category === "lfp" || input.category === "lfr") && input.memberType !== "player") {
		pushFieldError(fieldErrors, "memberType", "LFP and LFR listings must target players.");
	}

	return fieldErrors;
}

function validateRecruitmentNumericFields(input: { minRatingRaw: string; maxRatingRaw: string }) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	if (input.minRatingRaw && !Number.isFinite(Number(input.minRatingRaw))) {
		pushFieldError(fieldErrors, "minRating", "Minimum rating must be a number.");
	}

	if (input.maxRatingRaw && !Number.isFinite(Number(input.maxRatingRaw))) {
		pushFieldError(fieldErrors, "maxRating", "Maximum rating must be a number.");
	}

	return fieldErrors;
}

function validateRecruitmentRankFields(input: { minRankRaw: string; maxRankRaw: string }) {
	const fieldErrors: Partial<Record<string, string[]>> = {};

	if (input.minRankRaw && !getRecruitmentRank(input.minRankRaw)) {
		pushFieldError(fieldErrors, "minRank", "Minimum rank is invalid.");
	}

	if (input.maxRankRaw && !getRecruitmentRank(input.maxRankRaw)) {
		pushFieldError(fieldErrors, "maxRank", "Maximum rank is invalid.");
	}

	return fieldErrors;
}

function validateCreateRecruitmentListingInput(input: CreateRecruitmentListingInput) {
	const fieldErrors = validateRecruitmentListingRules(input);
	const parsed = v.safeParse(CreateRecruitmentListingSchema, input);

	if (!parsed.success) {
		mergeFieldErrors(fieldErrors, collectFieldErrors(parsed.issues));
	}

	return fieldErrors;
}

function validateUpdateRecruitmentListingInput(
	input: UpdateRecruitmentListingInput,
	ownerType: RecruitmentOwnerType
) {
	const fieldErrors = validateRecruitmentListingRules({
		category: input.category as "lft" | "lfp" | "lfr" | "lfs",
		ownerType,
		memberType: input.memberType as "player" | "staff",
	});
	const parsed = v.safeParse(UpdateRecruitmentListingSchema, input);

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
	revalidatePath(appRoutes.recruiting.root);
	revalidatePath(appRoutes.recruiting.conversations);
	revalidatePath("/recruiting");
	revalidatePath("/players");

	if (input.playerUsername) revalidatePath(`/players/${input.playerUsername}`);

	if (input.teamId) {
		revalidatePath(appRoutes.teams.byId(input.teamId));
		revalidatePath(appRoutes.teams.recruiting(input.teamId));
		revalidatePath(`/teams/${input.teamId}`);
		const orgId = input.orgId ?? (await getVerifiedTeamOrgId(input.teamId));
		if (orgId) {
			revalidatePath(appRoutes.orgs.byId(orgId));
			const slug = await getOrgSlug(orgId);
			if (slug) revalidatePath(`/orgs/${slug}`);
		}
		return;
	}

	if (input.orgId) {
		revalidatePath(appRoutes.orgs.byId(input.orgId));
		const slug = await getOrgSlug(input.orgId);
		if (slug) revalidatePath(`/orgs/${slug}`);
	}
}

export async function createRecruitmentListingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { listingId?: string }> {
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const ownerType =
		(getOptionalString(formData, "ownerType") as "player" | "team" | "organization" | undefined) ??
		"player";
	const memberType =
		(getOptionalString(formData, "memberType") as "player" | "staff" | undefined) ?? "player";
	const teamId = getOptionalString(formData, "teamId");
	const organizationId = getOptionalString(formData, "organizationId");
	const minRankRaw = getString(formData, "minRank");
	const maxRankRaw = getString(formData, "maxRank");
	const minRatingRaw = getString(formData, "minRating");
	const maxRatingRaw = getString(formData, "maxRating");
	const input: CreateRecruitmentListingInput = {
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
		minRank: getRecruitmentRank(minRankRaw),
		maxRank: getRecruitmentRank(maxRankRaw),
		minRating: getOptionalNumber(formData, "minRating"),
		maxRating: getOptionalNumber(formData, "maxRating"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
		teamId,
		organizationId,
	};
	const fieldErrors = validateCreateRecruitmentListingInput(input);
	mergeFieldErrors(fieldErrors, validateRecruitmentRankFields({ minRankRaw, maxRankRaw }));
	mergeFieldErrors(fieldErrors, validateRecruitmentNumericFields({ minRatingRaw, maxRatingRaw }));
	if (hasFieldErrors(fieldErrors)) return { fieldErrors };

	const result = await apiPost<{ listingId: string }>(apiRoutes.recruitment.listings.root, input);
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({
		teamId,
		orgId: organizationId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true, listingId: result.listingId };
}

export async function updateRecruitmentListingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const listingId = getString(formData, "listingId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");
	const minRankRaw = getString(formData, "minRank");
	const maxRankRaw = getString(formData, "maxRank");
	const minRatingRaw = getString(formData, "minRating");
	const maxRatingRaw = getString(formData, "maxRating");
	const ownerType =
		(getOptionalString(formData, "ownerType") as RecruitmentOwnerType | undefined) ?? "player";
	const input: UpdateRecruitmentListingInput = {
		listingId,
		category: getString(formData, "category") as "lft" | "lfp" | "lfr" | "lfs",
		status: getOptionalString(formData, "status") as
			| "open"
			| "closed"
			| "fulfilled"
			| "expired"
			| undefined,
		title: getString(formData, "title"),
		description: getOptionalString(formData, "description"),
		memberType: getString(formData, "memberType") as "player" | "staff",
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
		gameRoles: getGameRoles(formData),
		minRank: getRecruitmentRank(minRankRaw),
		maxRank: getRecruitmentRank(maxRankRaw),
		minRating: getOptionalNumber(formData, "minRating"),
		maxRating: getOptionalNumber(formData, "maxRating"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
	};
	const fieldErrors = validateUpdateRecruitmentListingInput(input, ownerType);
	mergeFieldErrors(fieldErrors, validateRecruitmentRankFields({ minRankRaw, maxRankRaw }));
	mergeFieldErrors(fieldErrors, validateRecruitmentNumericFields({ minRatingRaw, maxRatingRaw }));
	if (hasFieldErrors(fieldErrors)) return { fieldErrors };

	const { listingId: _listingId, ...body } = input;
	const result = await apiPatch(apiRoutes.recruitment.listings.byId(listingId), body);
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({ teamId, orgId });
	return { success: true };
}

export async function deleteRecruitmentListingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const listingId = getString(formData, "listingId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");
	const ownerType = getOptionalString(formData, "ownerType");

	const result = await apiDelete(apiRoutes.recruitment.listings.byId(listingId));
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({
		teamId,
		orgId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true };
}

export async function createRecruitmentApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { conversationId?: string; applicationId?: string }> {
	const listingId = getString(formData, "listingId");
	const result = await apiPost<{ applicationId: string; conversationId: string }>(
		apiRoutes.recruitment.listings.applications(listingId),
		{
			message: getOptionalString(formData, "message"),
			senderTeamId: getOptionalString(formData, "senderTeamId"),
			senderOrganizationId: getOptionalString(formData, "senderOrganizationId"),
		}
	);
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return {
		success: true,
		conversationId: result.conversationId,
		applicationId: result.applicationId,
	};
}

export async function withdrawRecruitmentApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const applicationId = getString(formData, "applicationId");
	const result = await apiDelete(apiRoutes.recruitment.applications.byId(applicationId));
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}

export async function decideRecruitmentApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const applicationId = getString(formData, "applicationId");
	const result = await apiPost(apiRoutes.recruitment.applications.decision(applicationId), {
		action: getString(formData, "action") as "accept" | "reject",
		gameRole: getOptionalString(formData, "gameRole") as "tank" | "damage" | "support" | undefined,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}
