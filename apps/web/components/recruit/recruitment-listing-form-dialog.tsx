"use client";

import {
	type CreateRecruitmentListingInput,
	CreateRecruitmentListingSchema,
	type RecruitmentListingSummary,
	type RecruitmentOwnerType,
	type UpdateRecruitmentListingInput,
	UpdateRecruitmentListingSchema,
} from "@scrimflow/shared";
import { type ComponentProps, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as v from "valibot";

import {
	createRecruitmentListingAction,
	updateRecruitmentListingAction,
} from "@/app/actions/recruit";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { RecruitEntityOption } from "@/lib/recruitment";
import {
	categoryMatchesOwner,
	getDefaultCategoryForOwner,
	getDefaultMemberTypeForCategory,
	getRecruitmentRank,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
	ROLE_LABELS,
	STAFF_ROLE_LABELS,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = ["lft", "lfp", "lfr", "lfs"] as const;
const OWNER_OPTIONS = [
	{ value: "player", label: "My profile" },
	{ value: "team", label: "Team" },
	{ value: "organization", label: "Organization" },
] as const;
const STATUS_OPTIONS = ["open", "closed", "fulfilled"] as const;
const ROLE_OPTIONS = ["tank", "damage", "support"] as const;
const STAFF_OPTIONS = ["coach", "analyst", "manager", "staff"] as const;

type OwnerType = "player" | "team" | "organization";
type FormFieldErrors = Partial<Record<string, string[]>>;

function pushFieldError(fieldErrors: FormFieldErrors, field: string, message: string) {
	fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function mergeFieldErrors(target: FormFieldErrors, source: FormFieldErrors) {
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
	const fieldErrors: FormFieldErrors = {};

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
	const fieldErrors: FormFieldErrors = {};

	if (input.ownerType === "team" && !input.teamId) {
		pushFieldError(fieldErrors, "teamId", "Select a team to publish this listing.");
	}

	if (input.ownerType === "organization" && !input.organizationId) {
		pushFieldError(
			fieldErrors,
			"organizationId",
			"Select an organization to publish this listing."
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
	const fieldErrors: FormFieldErrors = {};

	if (input.minRatingRaw && !Number.isFinite(Number(input.minRatingRaw))) {
		pushFieldError(fieldErrors, "minRating", "Minimum rating must be a number.");
	}

	if (input.maxRatingRaw && !Number.isFinite(Number(input.maxRatingRaw))) {
		pushFieldError(fieldErrors, "maxRating", "Maximum rating must be a number.");
	}

	return fieldErrors;
}

function validateRecruitmentRankFields(input: { minRankRaw: string; maxRankRaw: string }) {
	const fieldErrors: FormFieldErrors = {};

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

interface RecruitmentListingFormDialogProps {
	triggerContent: ReactNode;
	triggerVariant?: ComponentProps<typeof Button>["variant"];
	triggerSize?: ComponentProps<typeof Button>["size"];
	triggerClassName?: string;
	mode?: "create" | "edit";
	listing?: RecruitmentListingSummary;
	ownerOptions?: RecruitEntityOption[];
	fixedOwnerType?: OwnerType;
	fixedTeamId?: string;
	fixedOrganizationId?: string;
}

export function RecruitmentListingFormDialog({
	triggerContent,
	triggerVariant = "default",
	triggerSize = "sm",
	triggerClassName,
	mode = "create",
	listing,
	ownerOptions = [],
	fixedOwnerType,
	fixedTeamId,
	fixedOrganizationId,
}: RecruitmentListingFormDialogProps) {
	const [open, setOpen] = useState(false);
	const pendingRef = useRef(false);
	const [ownerType, setOwnerType] = useState<OwnerType>(
		fixedOwnerType ?? listing?.ownerType ?? "player"
	);
	const [category, setCategory] = useState(
		listing?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player")
	);
	const [status, setStatus] = useState(listing?.status ?? "open");
	const [title, setTitle] = useState(listing?.title ?? "");
	const [description, setDescription] = useState(listing?.description ?? "");
	const [memberType, setMemberType] = useState<"player" | "staff">(
		listing?.memberType ?? getDefaultMemberTypeForCategory(listing?.category ?? category)
	);
	const [staffRole, setStaffRole] = useState(listing?.staffRole ?? "staff");
	const [gameRoles, setGameRoles] = useState<Array<"tank" | "damage" | "support">>(
		listing?.gameRoles ?? []
	);
	const [region, setRegion] = useState(listing?.region ?? "");
	const [minRank, setMinRank] = useState(listing?.minRank ?? "");
	const [maxRank, setMaxRank] = useState(listing?.maxRank ?? "");
	const [minRating, setMinRating] = useState(listing?.minRating?.toString() ?? "");
	const [maxRating, setMaxRating] = useState(listing?.maxRating?.toString() ?? "");
	const [selectedEntityId, setSelectedEntityId] = useState(
		listing?.teamId ?? listing?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
	);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [formError, setFormError] = useState<string | undefined>(undefined);

	const action =
		mode === "create" ? createRecruitmentListingAction : updateRecruitmentListingAction;
	const { state, submit, isPending } = useFormAction(action, {
		loadingMessage: mode === "create" ? "Publishing listing…" : "Saving listing…",
		successMessage: mode === "create" ? "Listing published" : "Listing updated",
	});

	const availableOwnerTypes = useMemo(() => {
		if (fixedOwnerType) return [fixedOwnerType];
		return OWNER_OPTIONS.filter((option) => {
			if (option.value === "player") return true;
			return ownerOptions.some((entity) => entity.type === option.value);
		}).map((option) => option.value);
	}, [fixedOwnerType, ownerOptions]);

	const effectiveOwnerType = fixedOwnerType ?? ownerType;
	const entityOptions = useMemo(
		() => ownerOptions.filter((entity) => entity.type === effectiveOwnerType),
		[effectiveOwnerType, ownerOptions]
	);
	const effectiveCategory = categoryMatchesOwner(category, effectiveOwnerType)
		? category
		: getDefaultCategoryForOwner(effectiveOwnerType);
	const effectiveMemberType = effectiveCategory === "lfs" ? "staff" : memberType;
	const resolvedEntityId =
		effectiveOwnerType === "team"
			? (fixedTeamId ?? selectedEntityId)
			: effectiveOwnerType === "organization"
				? (fixedOrganizationId ?? selectedEntityId)
				: undefined;
	const ownerSelectionMissing = effectiveOwnerType !== "player" && !resolvedEntityId;

	function clearErrors(...keys: string[]) {
		if (keys.length === 0) {
			setFieldErrors({});
			setFormError(undefined);
			return;
		}

		setFieldErrors((current) => {
			const next = { ...current };
			for (const key of keys) delete next[key];
			return next;
		});
		if (keys.includes("form")) setFormError(undefined);
	}

	useEffect(() => {
		if (!categoryMatchesOwner(category, effectiveOwnerType)) {
			setCategory(getDefaultCategoryForOwner(effectiveOwnerType));
		}
	}, [category, effectiveOwnerType]);

	useEffect(() => {
		if (effectiveCategory === "lfs") {
			setMemberType("staff");
			setGameRoles([]);
		} else {
			setMemberType("player");
			setStaffRole("staff");
		}
	}, [effectiveCategory]);

	useEffect(() => {
		if (!fixedOwnerType && !availableOwnerTypes.includes(ownerType)) {
			setOwnerType(availableOwnerTypes[0] ?? "player");
		}
	}, [availableOwnerTypes, fixedOwnerType, ownerType]);

	useEffect(() => {
		if (fixedTeamId) {
			if (selectedEntityId !== fixedTeamId) setSelectedEntityId(fixedTeamId);
			return;
		}

		if (fixedOrganizationId) {
			if (selectedEntityId !== fixedOrganizationId) setSelectedEntityId(fixedOrganizationId);
			return;
		}

		if (effectiveOwnerType === "player") {
			if (selectedEntityId !== "") setSelectedEntityId("");
			return;
		}

		if (entityOptions.some((entity) => entity.id === selectedEntityId)) return;

		if (entityOptions.length === 1) {
			setSelectedEntityId(entityOptions[0].id);
			return;
		}

		if (selectedEntityId !== "") setSelectedEntityId("");
	}, [effectiveOwnerType, entityOptions, fixedOrganizationId, fixedTeamId, selectedEntityId]);

	useEffect(() => {
		if (!state) return;

		pendingRef.current = false;

		if (state.success) {
			setFieldErrors({});
			setFormError(undefined);
			setOpen(false);
			return;
		}

		if (state.fieldErrors) {
			setFieldErrors(state.fieldErrors);
			setFormError(undefined);
			return;
		}

		setFormError(state.error);
	}, [state]);

	function resetState() {
		setOwnerType(fixedOwnerType ?? listing?.ownerType ?? "player");
		setCategory(listing?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player"));
		setStatus(listing?.status ?? "open");
		setTitle(listing?.title ?? "");
		setDescription(listing?.description ?? "");
		setMemberType(listing?.memberType ?? "player");
		setStaffRole(listing?.staffRole ?? "staff");
		setGameRoles(listing?.gameRoles ?? []);
		setRegion(listing?.region ?? "");
		setMinRank(listing?.minRank ?? "");
		setMaxRank(listing?.maxRank ?? "");
		setMinRating(listing?.minRating?.toString() ?? "");
		setMaxRating(listing?.maxRating?.toString() ?? "");
		setSelectedEntityId(
			listing?.teamId ?? listing?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
		);
		clearErrors();
	}

	function toggleGameRole(role: "tank" | "damage" | "support") {
		clearErrors("gameRoles", "memberType", "form");
		setGameRoles((current) =>
			current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		clearErrors();

		const createInput: CreateRecruitmentListingInput = {
			category: effectiveCategory,
			ownerType: effectiveOwnerType,
			title: title.trim(),
			description: description.trim() || undefined,
			memberType: effectiveMemberType,
			staffRole: effectiveMemberType === "staff" ? staffRole : undefined,
			gameRoles,
			minRank: getRecruitmentRank(minRank),
			maxRank: getRecruitmentRank(maxRank),
			minRating: minRating.trim() ? Number(minRating) : undefined,
			maxRating: maxRating.trim() ? Number(maxRating) : undefined,
			region: region.trim() || undefined,
			teamId: effectiveOwnerType === "team" ? resolvedEntityId : undefined,
			organizationId: effectiveOwnerType === "organization" ? resolvedEntityId : undefined,
		};
		const nextFieldErrors =
			mode === "create"
				? validateCreateRecruitmentListingInput(createInput)
				: validateUpdateRecruitmentListingInput(
						{
							listingId: listing?.id ?? "",
							category: effectiveCategory,
							status,
							title: title.trim(),
							description: description.trim() || undefined,
							memberType: effectiveMemberType,
							staffRole: effectiveMemberType === "staff" ? staffRole : undefined,
							gameRoles,
							minRank: getRecruitmentRank(minRank),
							maxRank: getRecruitmentRank(maxRank),
							minRating: minRating.trim() ? Number(minRating) : undefined,
							maxRating: maxRating.trim() ? Number(maxRating) : undefined,
							region: region.trim() || undefined,
						},
						effectiveOwnerType
					);
		mergeFieldErrors(
			nextFieldErrors,
			validateRecruitmentRankFields({
				minRankRaw: minRank.trim(),
				maxRankRaw: maxRank.trim(),
			})
		);
		mergeFieldErrors(
			nextFieldErrors,
			validateRecruitmentNumericFields({
				minRatingRaw: minRating.trim(),
				maxRatingRaw: maxRating.trim(),
			})
		);

		if (Object.keys(nextFieldErrors).length > 0) {
			setFieldErrors(nextFieldErrors);
			return;
		}

		pendingRef.current = true;
		const fd = new FormData();
		if (listing) fd.set("listingId", listing.id);
		fd.set("ownerType", effectiveOwnerType);
		fd.set("category", effectiveCategory);
		fd.set("title", createInput.title);
		if (createInput.description) fd.set("description", createInput.description);
		fd.set("memberType", effectiveMemberType);
		if (createInput.region) fd.set("region", createInput.region);
		if (createInput.minRank) fd.set("minRank", createInput.minRank);
		if (createInput.maxRank) fd.set("maxRank", createInput.maxRank);
		if (minRating.trim()) fd.set("minRating", minRating.trim());
		if (maxRating.trim()) fd.set("maxRating", maxRating.trim());
		if (mode === "edit") fd.set("status", status);
		if (effectiveOwnerType === "team" && resolvedEntityId) fd.set("teamId", resolvedEntityId);
		if (effectiveOwnerType === "organization" && resolvedEntityId) {
			fd.set("organizationId", resolvedEntityId);
		}
		if (effectiveMemberType === "staff") fd.set("staffRole", staffRole);
		for (const role of gameRoles) fd.append("gameRoles", role);
		submit(fd);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>
				<Button className={triggerClassName} size={triggerSize} variant={triggerVariant}>
					{triggerContent}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "New recruiting listing" : "Edit recruiting listing"}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-5">
					{!fixedOwnerType && availableOwnerTypes.length > 1 && (
						<Field>
							<FieldLabel>Posting as</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-3">
								{OWNER_OPTIONS.filter((option) => availableOwnerTypes.includes(option.value)).map(
									(option) => (
										<button
											key={option.value}
											type="button"
											data-selected={ownerType === option.value}
											onClick={() => {
												setOwnerType(option.value);
												clearErrors("ownerType", "teamId", "organizationId", "category", "form");
											}}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{option.label}
										</button>
									)
								)}
							</div>
							<FieldError>{fieldErrors.ownerType?.join(" ")}</FieldError>
						</Field>
					)}

					{effectiveOwnerType !== "player" && (
						<Field>
							<FieldLabel>{effectiveOwnerType === "team" ? "Team" : "Organization"}</FieldLabel>
							{entityOptions.length > 1 && !fixedTeamId && !fixedOrganizationId ? (
								<div className="grid gap-2">
									{entityOptions.map((entity) => (
										<button
											key={entity.id}
											type="button"
											data-selected={selectedEntityId === entity.id}
											onClick={() => {
												setSelectedEntityId(entity.id);
												clearErrors("teamId", "organizationId", "form");
											}}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{entity.label}
										</button>
									))}
								</div>
							) : (
								<div className="border px-3 py-2 text-xs text-muted-foreground">
									{fixedOwnerType
										? `This listing will publish from the current ${effectiveOwnerType} workspace.`
										: entityOptions.length === 1
											? `${entityOptions[0].label} is selected automatically.`
											: `No ${effectiveOwnerType === "team" ? "team" : "organization"} is available for this listing.`}
								</div>
							)}
							{effectiveOwnerType === "team" && ownerSelectionMissing ? (
								<FieldDescription>Select a team context before publishing.</FieldDescription>
							) : null}
							{effectiveOwnerType === "organization" && ownerSelectionMissing ? (
								<FieldDescription>
									Select an organization context before publishing.
								</FieldDescription>
							) : null}
							<FieldError>
								{(fieldErrors.teamId ?? fieldErrors.organizationId)?.join(" ")}
							</FieldError>
						</Field>
					)}

					<Field>
						<FieldLabel>Category</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							{CATEGORY_OPTIONS.filter((option) =>
								categoryMatchesOwner(option, effectiveOwnerType)
							).map((option) => (
								<button
									key={option}
									type="button"
									data-selected={effectiveCategory === option}
									onClick={() => {
										setCategory(option);
										clearErrors("category", "memberType", "form");
									}}
									className={cn(
										"border px-3 py-3 text-left transition-colors hover:bg-muted",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
									)}
								>
									<p className="text-xs font-semibold">{RECRUITMENT_CATEGORY_LABELS[option]}</p>
									<p className="mt-1 text-[11px] text-muted-foreground">
										{RECRUITMENT_CATEGORY_DESCRIPTIONS[option]}
									</p>
								</button>
							))}
						</div>
						<FieldError>{fieldErrors.category?.join(" ")}</FieldError>
					</Field>

					<Field>
						<FieldLabel>Title</FieldLabel>
						<Input
							value={title}
							onChange={(e) => {
								setTitle(e.target.value);
								clearErrors("title", "form");
							}}
							maxLength={120}
							placeholder="Short headline for this opportunity"
						/>
						<FieldError>{fieldErrors.title?.join(" ")}</FieldError>
					</Field>

					<Field>
						<FieldLabel>Description</FieldLabel>
						<Textarea
							value={description}
							onChange={(e) => {
								setDescription(e.target.value);
								clearErrors("description", "form");
							}}
							rows={5}
							maxLength={800}
							placeholder="What are you looking for, what level do you need, and what should responders know?"
						/>
						<FieldError>{fieldErrors.description?.join(" ")}</FieldError>
					</Field>

					<Field>
						<FieldLabel>Target</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							{(["player", "staff"] as const)
								.filter((option) => (effectiveCategory === "lfs" ? true : option === "player"))
								.map((option) => (
									<button
										key={option}
										type="button"
										data-selected={effectiveMemberType === option}
										onClick={() => {
											setMemberType(option);
											clearErrors("memberType", "staffRole", "gameRoles", "form");
										}}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{MEMBER_TYPE_LABELS[option]}
									</button>
								))}
						</div>
						<FieldError>{fieldErrors.memberType?.join(" ")}</FieldError>
					</Field>

					{effectiveMemberType === "staff" ? (
						<Field>
							<FieldLabel>Staff role</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-2">
								{STAFF_OPTIONS.map((option) => (
									<button
										key={option}
										type="button"
										data-selected={staffRole === option}
										onClick={() => {
											setStaffRole(option);
											clearErrors("staffRole", "form");
										}}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{STAFF_ROLE_LABELS[option]}
									</button>
								))}
							</div>
							<FieldError>{fieldErrors.staffRole?.join(" ")}</FieldError>
						</Field>
					) : (
						<>
							<Field>
								<FieldLabel>Game roles</FieldLabel>
								<div className="grid gap-2 sm:grid-cols-3">
									{ROLE_OPTIONS.map((option) => (
										<button
											key={option}
											type="button"
											data-selected={gameRoles.includes(option)}
											onClick={() => toggleGameRole(option)}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{ROLE_LABELS[option]}
										</button>
									))}
								</div>
								<FieldError>{fieldErrors.gameRoles?.join(" ")}</FieldError>
							</Field>

							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel>Min rank</FieldLabel>
									<Input
										value={minRank}
										onChange={(e) => {
											setMinRank(e.target.value);
											clearErrors("minRank", "form");
										}}
										placeholder="diamond"
									/>
									<FieldError>{fieldErrors.minRank?.join(" ")}</FieldError>
								</Field>
								<Field>
									<FieldLabel>Max rank</FieldLabel>
									<Input
										value={maxRank}
										onChange={(e) => {
											setMaxRank(e.target.value);
											clearErrors("maxRank", "form");
										}}
										placeholder="champion"
									/>
									<FieldError>{fieldErrors.maxRank?.join(" ")}</FieldError>
								</Field>
								<Field>
									<FieldLabel>Min rating</FieldLabel>
									<Input
										value={minRating}
										onChange={(e) => {
											setMinRating(e.target.value);
											clearErrors("minRating", "form");
										}}
										inputMode="numeric"
										placeholder="3200"
									/>
									<FieldError>{fieldErrors.minRating?.join(" ")}</FieldError>
								</Field>
								<Field>
									<FieldLabel>Max rating</FieldLabel>
									<Input
										value={maxRating}
										onChange={(e) => {
											setMaxRating(e.target.value);
											clearErrors("maxRating", "form");
										}}
										inputMode="numeric"
										placeholder="4300"
									/>
									<FieldError>{fieldErrors.maxRating?.join(" ")}</FieldError>
								</Field>
							</div>
						</>
					)}

					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>Region</FieldLabel>
							<Input
								value={region}
								onChange={(e) => {
									setRegion(e.target.value);
									clearErrors("region", "form");
								}}
								placeholder="EU"
								maxLength={60}
							/>
							<FieldError>{fieldErrors.region?.join(" ")}</FieldError>
						</Field>

						{mode === "edit" && (
							<Field>
								<FieldLabel>Status</FieldLabel>
								<div className="grid gap-2 sm:grid-cols-3">
									{STATUS_OPTIONS.map((option) => (
										<button
											key={option}
											type="button"
											data-selected={status === option}
											onClick={() => {
												setStatus(option);
												clearErrors("status", "form");
											}}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium capitalize transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{option}
										</button>
									))}
								</div>
								<FieldError>{fieldErrors.status?.join(" ")}</FieldError>
							</Field>
						)}
					</div>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending || ownerSelectionMissing}>
							{isPending && <Spinner className="mr-1.5" />}
							{mode === "create" ? "Publish listing" : "Save changes"}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								resetState();
								setOpen(false);
							}}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
