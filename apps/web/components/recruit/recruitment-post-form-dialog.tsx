"use client";

import type { CreateRecruitmentPostInput, UpdateRecruitmentPostInput } from "@scrimflow/app-sdk";
import {
	CreateRecruitmentPostSchema,
	type RecruitmentOwnerType,
	type RecruitmentPostSummary,
	UpdateRecruitmentPostSchema,
} from "@scrimflow/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import * as v from "valibot";

import {
	createRecruitmentPostAction,
	updateRecruitmentPostAction,
} from "@/app/dashboard/recruit/actions/recruit";
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
	{ value: "organization", label: "Organisation" },
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

function validateRecruitmentPostRules(input: {
	category: "lft" | "lfp" | "lfr" | "lfs";
	ownerType: RecruitmentOwnerType;
	memberType: "player" | "staff";
	teamId?: string;
	organizationId?: string;
}) {
	const fieldErrors: FormFieldErrors = {};

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
	const fieldErrors: FormFieldErrors = {};

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

interface RecruitmentPostFormDialogProps {
	children: React.ReactNode;
	mode?: "create" | "edit";
	post?: RecruitmentPostSummary;
	ownerOptions?: RecruitEntityOption[];
	fixedOwnerType?: OwnerType;
	fixedTeamId?: string;
	fixedOrganizationId?: string;
}

export function RecruitmentPostFormDialog({
	children,
	mode = "create",
	post,
	ownerOptions = [],
	fixedOwnerType,
	fixedTeamId,
	fixedOrganizationId,
}: RecruitmentPostFormDialogProps) {
	const [open, setOpen] = useState(false);
	const pendingRef = useRef(false);
	const [ownerType, setOwnerType] = useState<OwnerType>(
		fixedOwnerType ?? post?.ownerType ?? "player"
	);
	const [category, setCategory] = useState(
		post?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player")
	);
	const [status, setStatus] = useState(post?.status ?? "open");
	const [title, setTitle] = useState(post?.title ?? "");
	const [description, setDescription] = useState(post?.description ?? "");
	const [memberType, setMemberType] = useState<"player" | "staff">(
		post?.memberType ?? getDefaultMemberTypeForCategory(post?.category ?? category)
	);
	const [staffRole, setStaffRole] = useState(post?.staffRole ?? "staff");
	const [gameRoles, setGameRoles] = useState<Array<"tank" | "damage" | "support">>(
		post?.gameRoles ?? []
	);
	const [region, setRegion] = useState(post?.region ?? "");
	const [minRank, setMinRank] = useState(post?.minRank ?? "");
	const [maxRank, setMaxRank] = useState(post?.maxRank ?? "");
	const [minSr, setMinSr] = useState(post?.minSr?.toString() ?? "");
	const [maxSr, setMaxSr] = useState(post?.maxSr?.toString() ?? "");
	const [selectedEntityId, setSelectedEntityId] = useState(
		post?.teamId ?? post?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
	);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [formError, setFormError] = useState<string | undefined>(undefined);

	const action = mode === "create" ? createRecruitmentPostAction : updateRecruitmentPostAction;
	const { state, submit, isPending } = useFormAction(action, {
		loadingMessage: mode === "create" ? "Publishing post…" : "Saving post…",
		successMessage: mode === "create" ? "Post published" : "Post updated",
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
		setOwnerType(fixedOwnerType ?? post?.ownerType ?? "player");
		setCategory(post?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player"));
		setStatus(post?.status ?? "open");
		setTitle(post?.title ?? "");
		setDescription(post?.description ?? "");
		setMemberType(post?.memberType ?? "player");
		setStaffRole(post?.staffRole ?? "staff");
		setGameRoles(post?.gameRoles ?? []);
		setRegion(post?.region ?? "");
		setMinRank(post?.minRank ?? "");
		setMaxRank(post?.maxRank ?? "");
		setMinSr(post?.minSr?.toString() ?? "");
		setMaxSr(post?.maxSr?.toString() ?? "");
		setSelectedEntityId(
			post?.teamId ?? post?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
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

		const createInput: CreateRecruitmentPostInput = {
			category: effectiveCategory,
			ownerType: effectiveOwnerType,
			title: title.trim(),
			description: description.trim() || undefined,
			memberType: effectiveMemberType,
			staffRole: effectiveMemberType === "staff" ? staffRole : undefined,
			gameRoles,
			minRank: minRank.trim() || undefined,
			maxRank: maxRank.trim() || undefined,
			minSr: minSr.trim() ? Number(minSr) : undefined,
			maxSr: maxSr.trim() ? Number(maxSr) : undefined,
			region: region.trim() || undefined,
			teamId: effectiveOwnerType === "team" ? resolvedEntityId : undefined,
			organizationId: effectiveOwnerType === "organization" ? resolvedEntityId : undefined,
		};
		const nextFieldErrors =
			mode === "create"
				? validateCreateRecruitmentPostInput(createInput)
				: validateUpdateRecruitmentPostInput(
						{
							postId: post?.id ?? "",
							category: effectiveCategory,
							status,
							title: title.trim(),
							description: description.trim() || undefined,
							memberType: effectiveMemberType,
							staffRole: effectiveMemberType === "staff" ? staffRole : undefined,
							gameRoles,
							minRank: minRank.trim() || undefined,
							maxRank: maxRank.trim() || undefined,
							minSr: minSr.trim() ? Number(minSr) : undefined,
							maxSr: maxSr.trim() ? Number(maxSr) : undefined,
							region: region.trim() || undefined,
						},
						effectiveOwnerType
					);
		mergeFieldErrors(
			nextFieldErrors,
			validateRecruitmentNumericFields({
				minSrRaw: minSr.trim(),
				maxSrRaw: maxSr.trim(),
			})
		);

		if (Object.keys(nextFieldErrors).length > 0) {
			setFieldErrors(nextFieldErrors);
			return;
		}

		pendingRef.current = true;
		const fd = new FormData();
		if (post) fd.set("postId", post.id);
		fd.set("ownerType", effectiveOwnerType);
		fd.set("category", effectiveCategory);
		fd.set("title", createInput.title);
		if (createInput.description) fd.set("description", createInput.description);
		fd.set("memberType", effectiveMemberType);
		if (createInput.region) fd.set("region", createInput.region);
		if (createInput.minRank) fd.set("minRank", createInput.minRank);
		if (createInput.maxRank) fd.set("maxRank", createInput.maxRank);
		if (minSr.trim()) fd.set("minSr", minSr.trim());
		if (maxSr.trim()) fd.set("maxSr", maxSr.trim());
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
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "New recruiting post" : "Edit recruiting post"}
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
							<FieldLabel>{effectiveOwnerType === "team" ? "Team" : "Organisation"}</FieldLabel>
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
										? `This post will publish from the current ${effectiveOwnerType} workspace.`
										: entityOptions.length === 1
											? `${entityOptions[0].label} is selected automatically.`
											: `No ${effectiveOwnerType === "team" ? "team" : "organisation"} is available for this post.`}
								</div>
							)}
							{effectiveOwnerType === "team" && ownerSelectionMissing ? (
								<FieldDescription>Select a team context before publishing.</FieldDescription>
							) : null}
							{effectiveOwnerType === "organization" && ownerSelectionMissing ? (
								<FieldDescription>
									Select an organisation context before publishing.
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
									<FieldLabel>Min SR</FieldLabel>
									<Input
										value={minSr}
										onChange={(e) => {
											setMinSr(e.target.value);
											clearErrors("minSr", "form");
										}}
										inputMode="numeric"
										placeholder="3200"
									/>
									<FieldError>{fieldErrors.minSr?.join(" ")}</FieldError>
								</Field>
								<Field>
									<FieldLabel>Max SR</FieldLabel>
									<Input
										value={maxSr}
										onChange={(e) => {
											setMaxSr(e.target.value);
											clearErrors("maxSr", "form");
										}}
										inputMode="numeric"
										placeholder="4300"
									/>
									<FieldError>{fieldErrors.maxSr?.join(" ")}</FieldError>
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
							{mode === "create" ? "Publish post" : "Save changes"}
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
